<?php

namespace App\Support\News;

use App\Models\NewsBatch;
use App\Models\NewsCluster;
use App\Models\NewsSentimentSnapshot;
use App\Support\MarketData;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

/**
 * Sentiment math: normalizing splits, labels, and the global snapshot
 * (weighted average of analyzed stories from the last 24h).
 */
class NewsSentiment
{
    public const IMPACT_RANKS = ['low' => 1, 'medium' => 2, 'high' => 3];

    private const WINDOW_HOURS = 24;

    // Coins shown in the sidebar's "Sentiment by coin".
    private const MAX_ASSETS = 6;

    /**
     * Whole percentages summing to exactly 100 (largest-remainder rounding).
     * All zeros or invalid input becomes fully neutral.
     *
     * @return array{bullish: int, bearish: int, neutral: int}
     */
    public static function normalize(float $bullish, float $bearish, float $neutral): array
    {
        $raw = ['bullish' => max(0, $bullish), 'bearish' => max(0, $bearish), 'neutral' => max(0, $neutral)];
        $total = array_sum($raw);

        if ($total <= 0) {
            return ['bullish' => 0, 'bearish' => 0, 'neutral' => 100];
        }

        $scaled = array_map(fn ($value) => $value / $total * 100, $raw);
        $floored = array_map(fn ($value) => (int) floor($value), $scaled);
        $remainders = array_map(fn ($value, $floor) => $value - $floor, $scaled, $floored);
        $remainders = array_combine(array_keys($scaled), $remainders);

        arsort($remainders);

        foreach (array_slice(array_keys($remainders), 0, 100 - array_sum($floored)) as $key) {
            $floored[$key]++;
        }

        return $floored;
    }

    /**
     * The highest of the three; any tie resolves to neutral.
     */
    public static function label(array $split): string
    {
        $max = max($split['bullish'], $split['bearish'], $split['neutral']);
        $leaders = array_keys(array_filter($split, fn ($value) => $value === $max));

        return count($leaders) === 1 ? $leaders[0] : 'neutral';
    }

    /**
     * impactWeight × recencyDecay × sourceCredibility.
     */
    public static function weight(string $impact, float $ageHours, float $credibility, float $halfLifeHours): float
    {
        return (self::IMPACT_RANKS[$impact] ?? 1)
            * (0.5 ** (max(0, $ageHours) / max(0.1, $halfLifeHours)))
            * max(0.5, min(1.0, $credibility));
    }

    /**
     * Store a new global snapshot, or return null (keeping the previous one)
     * when no analyzed story falls in the window.
     */
    public static function snapshot(?NewsBatch $batch, ?string $aiSummary = null): ?NewsSentimentSnapshot
    {
        $now = CarbonImmutable::now();

        $stories = NewsCluster::with('primaryArticle')
            ->where('analysis_status', NewsCluster::STATUS_ANALYZED)
            ->where('latest_published_at', '>=', $now->subHours(self::WINDOW_HOURS))
            ->get();

        if ($stories->isEmpty()) {
            return null;
        }

        $halfLife = (float) config('news.sentiment_half_life_hours', 12);

        $weighted = $stories->map(fn (NewsCluster $story) => [
            'story' => $story,
            'weight' => self::weight(
                $story->impact ?? 'low',
                $story->latest_published_at->diffInMinutes($now, true) / 60,
                $story->primaryArticle?->credibility ?? 0.5,
                $halfLife,
            ),
        ]);

        $overall = self::average($weighted);

        $byAsset = $weighted
            ->flatMap(fn (array $entry) => collect($entry['story']->assets)->map(fn ($asset) => [$asset, $entry]))
            ->groupBy(fn (array $pair) => $pair[0])
            ->map(fn (Collection $pairs, string $asset) => [
                'asset' => $asset,
                'sentiment' => self::average($pairs->pluck(1)),
                'storyCount' => $pairs->count(),
            ])
            ->sortByDesc('storyCount')
            ->take(self::MAX_ASSETS)
            ->values()
            ->all();

        return NewsSentimentSnapshot::create([
            'batch_id' => $batch?->id,
            ...$overall,
            'label' => self::label($overall),
            // A run without AI keeps the last real summary.
            'ai_summary' => $aiSummary ?? NewsSentimentSnapshot::latest('id')->value('ai_summary'),
            'by_asset' => $byAsset,
            'market' => MarketData::remember('market_global'),
            'story_count' => $stories->count(),
        ]);
    }

    /**
     * @param  Collection<int, array{story: NewsCluster, weight: float}>  $weighted
     * @return array{bullish: int, bearish: int, neutral: int}
     */
    private static function average(Collection $weighted): array
    {
        $total = $weighted->sum('weight');

        if ($total <= 0) {
            return self::normalize(0, 0, 0);
        }

        $sum = fn (string $field) => $weighted->sum(fn (array $entry) => $entry['story']->{$field} * $entry['weight']) / $total;

        return self::normalize($sum('sentiment_bullish'), $sum('sentiment_bearish'), $sum('sentiment_neutral'));
    }
}
