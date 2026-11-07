<?php

namespace App\Services\Insight;

use App\Models\NewsCluster;
use App\Support\News\NewsSentiment;
use Carbon\CarbonImmutable;

/**
 * Prepares what the outlook needs: the compact JSON sent to Claude (never raw
 * candles), and the coin's recent news from the existing feed, which costs no
 * extra AI call.
 */
class InsightSummary
{
    private const TOP_HEADLINES = 3;

    private const MAX_STORIES = 25;

    private const DAY_SECONDS = 86_400;

    private const SIGNIFICANT_DIGITS = 6;

    /**
     * @return array{stories: int, sentiment: ?array, topHeadlines: array, pins: array}
     */
    public static function news(string $symbol, int $seconds): array
    {
        $stories = NewsCluster::with('primaryArticle')
            ->where('analysis_status', NewsCluster::STATUS_ANALYZED)
            ->whereNotNull('primary_article_id')
            ->whereJsonContains('assets', $symbol)
            ->where('latest_published_at', '>=', CarbonImmutable::now()->subSeconds($seconds))
            ->orderByDesc('trader_relevance')
            ->orderByDesc('latest_published_at')
            ->limit(self::MAX_STORIES)
            ->get();

        if ($stories->isEmpty()) {
            return ['stories' => 0, 'sentiment' => null, 'topHeadlines' => [], 'pins' => []];
        }

        $average = fn (string $column) => $stories->avg($column);
        $sentiment = NewsSentiment::normalize($average('sentiment_bullish'), $average('sentiment_bearish'), $average('sentiment_neutral'));

        return [
            'stories' => $stories->count(),
            'sentiment' => ['bullish' => $sentiment['bullish'], 'neutral' => $sentiment['neutral'], 'bearish' => $sentiment['bearish']],
            'topHeadlines' => $stories->take(self::TOP_HEADLINES)->map(fn (NewsCluster $story) => $story->primaryArticle->title)->values()->all(),
            // Links and sources come from the feed, never from the AI.
            'pins' => $stories
                ->map(fn (NewsCluster $story) => [
                    'time' => $story->primaryArticle->published_at->getTimestamp(),
                    'headline' => $story->primaryArticle->title,
                    'source' => $story->primaryArticle->source_name,
                    'url' => $story->primaryArticle->url,
                    'label' => $story->label,
                ])
                ->sortBy('time')
                ->values()
                ->all(),
        ];
    }

    public static function forAi(string $symbol, string $timeframe, array $analysis, array $candles, array $news): array
    {
        $price = $analysis['price'];

        return [
            'coin' => $symbol,
            'timeframe' => $timeframe,
            'candleMinutes' => count($candles) > 1 ? (int) (($candles[1]['time'] - $candles[0]['time']) / 60) : null,
            'price' => self::shortened($price),
            'currency' => 'usd',
            'change24hPct' => self::change24hPct($candles, $price),
            'trend' => $analysis['trend'],
            'ema20' => self::latest($analysis['ema20']),
            'ema50' => self::latest($analysis['ema50']),
            'rsi' => $analysis['rsiLatest'],
            'volume' => $analysis['volume'],
            'levels' => array_map(fn (array $zone) => [
                'id' => $zone['id'],
                'type' => $zone['type'],
                'from' => self::shortened($zone['from']),
                'to' => self::shortened($zone['to']),
                'distancePct' => $zone['distancePct'],
                'strength' => $zone['strength'],
                'touches' => $zone['touches'],
                // How often price bounced off the level, and went through it.
                'held' => $zone['rejections'] ?? 0,
                'broke' => $zone['breaks'] ?? 0,
                'testing' => $zone['testing'],
                // Found on the 30D chart, or on this one and confirmed by it.
                'source' => $zone['source'] ?? $timeframe,
                'confluence' => $zone['confluence'] ?? false,
            ], $analysis['zones']),
            'news' => $news['stories'] === 0 ? null : [
                'storyCount' => $news['stories'],
                'sentiment' => $news['sentiment'],
                'topHeadlines' => $news['topHeadlines'],
            ],
        ];
    }

    /**
     * Against the newest candle at least a day old, or the oldest one on hand.
     */
    public static function change24hPct(array $candles, float $price): ?float
    {
        if ($candles === []) {
            return null;
        }

        $from = $candles[count($candles) - 1]['time'] - self::DAY_SECONDS;
        $base = $candles[0];

        foreach ($candles as $candle) {
            if ($candle['time'] > $from) {
                break;
            }

            $base = $candle;
        }

        return $base['close'] > 0 ? round(($price - $base['close']) / $base['close'] * 100, 2) : null;
    }

    private static function latest(array $line): ?float
    {
        return $line === [] ? null : self::shortened($line[count($line) - 1]['value']);
    }

    /**
     * Fewer digits mean fewer tokens, without losing small prices the way
     * rounding to fixed decimals would.
     */
    private static function shortened(float $value): float
    {
        return (float) sprintf('%.' . (self::SIGNIFICANT_DIGITS - 1) . 'e', $value);
    }
}
