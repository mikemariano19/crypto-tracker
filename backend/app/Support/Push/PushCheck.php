<?php

namespace App\Support\Push;

use App\Models\NewsCluster;
use App\Models\NewsSentimentSnapshot;
use App\Models\PriceAlert;
use App\Models\PushNotification;
use App\Models\PushSubscription;
use App\Support\MarketData;
use App\Support\PriceCache;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Cache;

/**
 * One pass over every alert: price alerts, market drop or rally, and the
 * daily brief. Plain code and cached prices only, no AI. Runs every 10
 * minutes from the scheduler, and from an external scheduler's call while
 * the free server would otherwise be asleep; the lock keeps them from
 * overlapping.
 */
class PushCheck
{
    // A price older than this could fire an alert the market has moved past.
    private const MAX_PRICE_AGE_SECONDS = 900;

    private const LOCK_SECONDS = 300;

    private const BTC_SAMPLES_KEY = 'push:btc_samples';

    // BTC's 4-hour move is measured against a sample from 3.5 to 4.5 hours ago.
    private const BTC_WINDOW_SECONDS = 14_400;

    private const BTC_WINDOW_SLACK_SECONDS = 1_800;

    public function __construct(private Notifier $notifier) {}

    /**
     * @return array{ran: bool, price: int, market: int, brief: int}
     */
    public function run(): array
    {
        $lock = Cache::lock('push:check', self::LOCK_SECONDS);

        if (!$this->notifier->isConfigured() || !$lock->get()) {
            return ['ran' => false, 'price' => 0, 'market' => 0, 'brief' => 0];
        }

        try {
            $counts = [
                'ran' => true,
                'price' => $this->priceAlerts(),
                'market' => $this->marketAlert(),
                'brief' => $this->briefs(),
            ];

            $this->cleanUp();

            return $counts;
        } finally {
            $lock->release();
        }
    }

    private function priceAlerts(): int
    {
        $alerts = PriceAlert::whereNull('triggered_at')->with('subscription')->get();

        if ($alerts->isEmpty()) {
            return 0;
        }

        $quotes = PriceCache::quotes($alerts->pluck('coin_id')->unique()->values()->all());
        $perUsd = MarketData::perUsd();
        $freshFrom = now()->getTimestamp() - self::MAX_PRICE_AGE_SECONDS;
        $sent = 0;

        foreach ($alerts->groupBy('push_subscription_id') as $own) {
            $subscription = $own->first()->subscription;

            // Not allowed now (quiet hours, cap, turned off): the alerts wait.
            if (!$subscription || !$this->notifier->allows($subscription, 'price')) {
                continue;
            }

            $hits = [];

            foreach ($own as $alert) {
                $usd = $quotes['data'][$alert->coin_id]['usd'] ?? null;
                $rate = $perUsd[$alert->currency] ?? null;

                if (!is_numeric($usd) || !$rate || ($quotes['fetched_at'][$alert->coin_id] ?? 0) < $freshFrom) {
                    continue;
                }

                $price = (float) $usd * $rate;

                if ($alert->isHitBy($price) && !$this->notifier->recentlyAlerted($subscription, $alert->coin_id)) {
                    $hits[] = [$alert, $price];
                }
            }

            if ($hits === []) {
                continue;
            }

            $coinIds = array_values(array_unique(array_map(fn (array $hit) => $hit[0]->coin_id, $hits)));

            if ($this->notifier->deliver($subscription, 'price', PushMessages::priceAlerts($hits), $coinIds)) {
                PriceAlert::whereIn('id', array_map(fn (array $hit) => $hit[0]->id, $hits))->update(['triggered_at' => now()]);
                $sent++;
            }
        }

        return $sent;
    }

    /**
     * Total market cap 5% either way in 24h, or BTC 7% in 4h. Sent once per
     * direction per cooldown, however long the move lasts.
     */
    private function marketAlert(): int
    {
        $settings = config('push.market');
        $global = MarketData::remember('market_global');
        $market24h = is_numeric($global['change_24h'] ?? null) ? (float) $global['change_24h'] : null;
        $btc4h = $this->btcChange4h();

        $move = match (true) {
            $market24h !== null && abs($market24h) >= $settings['market_cap_24h_pct'] => ['kind' => 'market', 'pct' => $market24h],
            $btc4h !== null && abs($btc4h) >= $settings['btc_4h_pct'] => ['kind' => 'btc', 'pct' => $btc4h],
            default => null,
        };

        if ($move === null) {
            return 0;
        }

        $cooldownKey = 'push:market:' . ($move['pct'] < 0 ? 'down' : 'up');

        if (!Cache::add($cooldownKey, true, now()->addHours($settings['cooldown_hours']))) {
            return 0;
        }

        $coins = collect(MarketData::remember('coins') ?? [])->keyBy('id');
        $change = fn (string $id) => is_numeric($coins[$id]['price_change_percentage_24h'] ?? null)
            ? (float) $coins[$id]['price_change_percentage_24h']
            : null;

        $message = PushMessages::market($move, $market24h, $change('bitcoin'), $change('ethereum'));
        $sent = 0;

        foreach (PushSubscription::cursor() as $subscription) {
            if ($this->notifier->allows($subscription, 'market') && $this->notifier->deliver($subscription, 'market', $message)) {
                $sent++;
            }
        }

        return $sent;
    }

    /**
     * Each run leaves a BTC price behind, so a later run can see the 4-hour
     * move. Null until a sample from about 4 hours ago exists.
     */
    private function btcChange4h(): ?float
    {
        $quotes = PriceCache::quotes(['bitcoin']);
        $usd = $quotes['data']['bitcoin']['usd'] ?? null;
        $now = now()->getTimestamp();

        if (!is_numeric($usd) || ($quotes['fetched_at']['bitcoin'] ?? 0) < $now - self::MAX_PRICE_AGE_SECONDS) {
            return null;
        }

        $keepFrom = $now - self::BTC_WINDOW_SECONDS - self::BTC_WINDOW_SLACK_SECONDS;
        $samples = array_values(array_filter(
            Cache::get(self::BTC_SAMPLES_KEY, []),
            fn (array $sample) => $sample[0] >= $keepFrom,
        ));

        $samples[] = [$now, (float) $usd];
        Cache::put(self::BTC_SAMPLES_KEY, $samples, now()->addDay());

        $best = null;

        foreach ($samples as [$time, $price]) {
            $offBy = abs($now - $time - self::BTC_WINDOW_SECONDS);

            if ($offBy <= self::BTC_WINDOW_SLACK_SECONDS && $price > 0 && ($best === null || $offBy < $best[0])) {
                $best = [$offBy, $price];
            }
        }

        return $best === null ? null : ((float) $usd - $best[1]) / $best[1] * 100;
    }

    /**
     * Within a few hours after each subscriber's chosen time, once a day.
     */
    private function briefs(): int
    {
        $message = null;
        $sent = 0;
        $lateAfter = (int) config('push.brief_late_after_minutes');

        foreach (PushSubscription::whereNotNull('brief_time')->cursor() as $subscription) {
            if (!$subscription->wants('brief')) {
                continue;
            }

            $local = $subscription->localNow();
            $due = $local->setTimeFromTimeString($subscription->brief_time);

            if ($subscription->last_brief_on?->toDateString() === $local->toDateString()
                || $local->lessThan($due)
                || $due->diffInMinutes($local) > $lateAfter) {
                continue;
            }

            // Marked first, so a failed send isn't retried into the evening.
            $subscription->update(['last_brief_on' => $local->toDateString()]);

            $message ??= $this->briefMessage();

            if ($this->notifier->deliver($subscription, 'brief', $message)) {
                $sent++;
            }
        }

        return $sent;
    }

    private function briefMessage(): array
    {
        $global = MarketData::remember('market_global');
        $snapshot = NewsSentimentSnapshot::latest('id')->first();

        $bigStories = NewsCluster::where('analysis_status', NewsCluster::STATUS_ANALYZED)
            ->where('impact', 'high')
            ->where('trader_relevance', '>=', (int) config('news.min_relevance'))
            ->where('latest_published_at', '>=', CarbonImmutable::now()->subDay())
            ->count();

        return PushMessages::brief(
            is_numeric($global['change_24h'] ?? null) ? (float) $global['change_24h'] : null,
            $snapshot ? [
                'bullish' => (int) $snapshot->bullish,
                'bearish' => (int) $snapshot->bearish,
                'neutral' => (int) $snapshot->neutral,
                'label' => (string) $snapshot->label,
            ] : null,
            $bigStories,
        );
    }

    private function cleanUp(): void
    {
        PushNotification::where('sent_at', '<', now()->subDays((int) config('push.history_days')))->delete();
        PriceAlert::where('triggered_at', '<', now()->subDays((int) config('push.triggered_alert_days')))->delete();
    }
}
