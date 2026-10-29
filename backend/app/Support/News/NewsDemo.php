<?php

namespace App\Support\News;

use App\Models\NewsCluster;
use App\Models\NewsSentimentSnapshot;
use Carbon\CarbonImmutable;

/**
 * Sample "AI" analysis for previewing the UI locally before the AI step is
 * enabled. Every generated text starts with [Demo] so it can't be mistaken
 * for real analysis, and `news:demo --clear` removes all of it.
 */
class NewsDemo
{
    public const PREFIX = '[Demo]';

    private const BEARISH_WORDS = '/\b(hack|exploit|drain|breach|lawsuit|charge|sue|plunge|dip|fall|drop|ban|crash|hawkish|pressure|reject|object|loss|outflow|tank)/i';

    private const BULLISH_WORDS = '/\b(approv|inflow|rally|rebound|record|surge|add|gain|launch|rais|buy|bullish|upgrade|grade|win)/i';

    /**
     * Fill the most relevant recent stories with sample analysis and build
     * a week of sample sentiment history.
     */
    public static function seed(int $stories = 12): int
    {
        $clusters = NewsCluster::with('primaryArticle')
            ->whereNotNull('primary_article_id')
            ->where('trader_relevance', '>=', (int) config('news.min_relevance'))
            ->whereIn('analysis_status', [NewsCluster::STATUS_PENDING, NewsCluster::STATUS_SKIPPED])
            ->orderByDesc('trader_relevance')
            ->limit($stories)
            ->get();

        foreach ($clusters as $cluster) {
            $title = $cluster->primaryArticle->title;
            $seed = crc32($cluster->id);
            $bearish = preg_match(self::BEARISH_WORDS, $title) === 1;
            $bullish = preg_match(self::BULLISH_WORDS, $title) === 1;

            [$bull, $bear] = match (true) {
                $bullish && !$bearish => [55 + $seed % 25, 5 + $seed % 15],
                $bearish && !$bullish => [5 + $seed % 15, 55 + $seed % 25],
                default => [25 + $seed % 20, 20 + $seed % 20],
            };

            $split = NewsSentiment::normalize($bull, $bear, max(0, 100 - $bull - $bear));
            $impact = NewsPipeline::impactFromRelevance($cluster->trader_relevance);
            $asset = $cluster->assets[0] ?? 'the market';

            $cluster->update([
                'analysis_status' => NewsCluster::STATUS_ANALYZED,
                'analyzed_at' => now(),
                'sentiment_bullish' => $split['bullish'],
                'sentiment_bearish' => $split['bearish'],
                'sentiment_neutral' => $split['neutral'],
                'label' => NewsSentiment::label($split),
                'impact' => $impact,
                'impact_rank' => NewsSentiment::IMPACT_RANKS[$impact],
                'confidence' => ['low', 'medium', 'high'][$seed % 3],
                'summary' => self::PREFIX . ' Sample summary. Real AI analysis appears here once the AI step is enabled.',
                'take_teaser' => self::PREFIX . " Sample take on what this may mean for {$asset}.",
                'take_view' => self::PREFIX . " Sample view: what to watch for {$asset} in the short term and the key risk. Not real analysis.",
            ]);
        }

        if ($clusters->isNotEmpty()) {
            self::seedHistory();
            NewsSentiment::snapshot(null, self::PREFIX . ' Sample market summary. Once AI is enabled, this is a two-sentence read on the narrative across the latest stories.');
        }

        NewsFeed::bumpVersion();

        return $clusters->count();
    }

    public static function clear(): int
    {
        $count = NewsCluster::where('summary', 'like', self::PREFIX . '%')->update([
            'analysis_status' => NewsCluster::STATUS_SKIPPED,
            'analyzed_at' => null,
            'sentiment_bullish' => null,
            'sentiment_bearish' => null,
            'sentiment_neutral' => null,
            'label' => null,
            'confidence' => null,
            'summary' => null,
            'take_teaser' => null,
            'take_view' => null,
        ]);

        NewsSentimentSnapshot::where('ai_summary', 'like', self::PREFIX . '%')->delete();
        NewsFeed::bumpVersion();

        return $count;
    }

    /**
     * Four sample snapshots a day for the past week, for the trend chart.
     */
    private static function seedHistory(): void
    {
        $start = CarbonImmutable::now()->subDays(7);

        for ($i = 0; $i < 28; $i++) {
            $bull = 40 + (int) round(15 * sin($i / 4));
            $bear = 25 - (int) round(10 * sin($i / 5));
            $split = NewsSentiment::normalize($bull, $bear, 100 - $bull - $bear);
            $at = $start->addHours($i * 6);

            $snapshot = new NewsSentimentSnapshot([
                ...$split,
                'label' => NewsSentiment::label($split),
                'ai_summary' => self::PREFIX . ' Sample history.',
                'by_asset' => [],
                'story_count' => 0,
            ]);
            $snapshot->created_at = $at;
            $snapshot->updated_at = $at;
            $snapshot->save();
        }
    }
}
