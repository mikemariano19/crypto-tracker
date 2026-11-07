<?php

namespace App\Services\Insight;

use App\Models\InsightOutlook;
use App\Support\PriceCache;
use Illuminate\Support\Facades\Log;

/**
 * Keeps score of the AI's outlooks: each is stored with its price, then checked
 * against the real move once its window has passed. An honest number to show
 * next to the outlook, and no extra AI cost.
 */
class OutlookAccuracy
{
    private const WINDOW_SECONDS = ['1d' => 86_400, '7d' => 604_800, '30d' => 2_592_000];

    private const STATS_DAYS = 30;

    private const KEEP_DAYS = 60;

    /**
     * Tracking must never cost a visitor their analysis, so failures only log.
     */
    public static function record(string $coinId, string $timeframe, array $ai, float $price): void
    {
        try {
            InsightOutlook::create([
                'coin_id' => $coinId,
                'timeframe' => $timeframe,
                'label' => $ai['label'],
                'price' => $price,
                'analyzed_at' => now(),
                'resolve_at' => now()->addSeconds(self::WINDOW_SECONDS[$timeframe]),
            ]);
        } catch (\Throwable $e) {
            Log::warning('Insight outlook not recorded', ['coin' => $coinId, 'message' => $e->getMessage()]);
        }
    }

    /**
     * Did the price do what the outlook leaned towards? A move inside the flat
     * band counts as "no real move", which is what a neutral outlook means, and
     * isn't a win for a bullish or bearish one.
     */
    public static function matched(string $label, float $movePct, float $flatBandPct): bool
    {
        return match ($label) {
            'bullish' => $movePct > $flatBandPct,
            'bearish' => $movePct < -$flatBandPct,
            default => abs($movePct) <= $flatBandPct,
        };
    }

    /**
     * Checks every outlook whose window has passed.
     *
     * @return array{resolved: int, skipped: int, waiting: int}
     */
    public static function resolveDue(): array
    {
        $counts = ['resolved' => 0, 'skipped' => 0, 'waiting' => 0];
        $lateAfter = (int) config('insight.accuracy.late_after_seconds');

        $due = InsightOutlook::whereNull('resolved_at')->where('resolve_at', '<=', now())->get();

        // A free server can sleep through its checks. A much later price isn't
        // a fair test of the outlook, so these are closed without a score.
        [$late, $onTime] = $due->partition(
            fn (InsightOutlook $outlook) => $outlook->resolve_at->diffInSeconds(now()) > $lateAfter,
        );

        foreach ($late as $outlook) {
            $outlook->update(['resolved_at' => now()]);
            $counts['skipped']++;
        }

        if ($onTime->isNotEmpty()) {
            $quotes = PriceCache::quotes($onTime->pluck('coin_id')->unique()->values()->all());

            foreach ($onTime as $outlook) {
                $price = $quotes['data'][$outlook->coin_id]['usd'] ?? null;

                // Try again next run rather than judge it on an old price.
                if (!is_numeric($price) || $quotes['stale'] || $outlook->price <= 0) {
                    $counts['waiting']++;

                    continue;
                }

                $move = ((float) $price - $outlook->price) / $outlook->price * 100;
                $band = (float) config("insight.accuracy.flat_band_pct.{$outlook->timeframe}");

                $outlook->update([
                    'resolved_at' => now(),
                    'move_pct' => round($move, 3),
                    'matched' => self::matched($outlook->label, $move, $band),
                ]);

                $counts['resolved']++;
            }
        }

        InsightOutlook::where('analyzed_at', '<', now()->subDays(self::KEEP_DAYS))->delete();

        return $counts;
    }

    /**
     * Across all coins, since one coin alone rarely has enough outlooks to mean
     * anything. Null until there are enough for a percentage to be fair.
     *
     * @return array{matchedPct: int, sample: int, days: int}|null
     */
    public static function stats(string $timeframe): ?array
    {
        try {
            $scored = InsightOutlook::where('timeframe', $timeframe)
                ->whereNotNull('matched')
                ->where('resolved_at', '>=', now()->subDays(self::STATS_DAYS))
                ->selectRaw('COUNT(*) as sample, SUM(CASE WHEN matched THEN 1 ELSE 0 END) as hits')
                ->first();
        } catch (\Throwable $e) {
            Log::warning('Insight accuracy not available', ['message' => $e->getMessage()]);

            return null;
        }

        $sample = (int) $scored?->sample;

        if ($sample < (int) config('insight.accuracy.min_sample')) {
            return null;
        }

        return [
            'matchedPct' => (int) round((int) $scored->hits / $sample * 100),
            'sample' => $sample,
            'days' => self::STATS_DAYS,
        ];
    }
}
