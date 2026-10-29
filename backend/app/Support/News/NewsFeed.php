<?php

namespace App\Support\News;

use App\Models\NewsArticle;
use App\Models\NewsBatch;
use App\Models\NewsCluster;
use App\Models\NewsSentimentSnapshot;
use App\Support\MarketData;
use Carbon\CarbonImmutable;
use Closure;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

/**
 * Read side of the news feed: queries and the JSON shapes the frontend
 * types in types/news.ts expect.
 *
 * Responses are cached under a version that changes with every published
 * batch, so a new batch is visible immediately. The short TTL keeps the
 * "last 6h / 24h" windows moving between batches.
 */
class NewsFeed
{
    public const PER_PAGE = 20;

    public const RANGES = ['6h' => 6, '24h' => 24, '3d' => 72];

    public const DEFAULT_RANGE = '3d';

    private const CACHE_SECONDS = 600;

    private const TRENDING_TAGS = 8;

    public static function version(): string
    {
        return Cache::rememberForever('news:version', fn () => (string) Str::ulid());
    }

    public static function bumpVersion(): void
    {
        Cache::forever('news:version', (string) Str::ulid());
    }

    public static function cached(string $name, array $params, Closure $build, int $seconds = self::CACHE_SECONDS): array
    {
        $key = 'news:' . self::version() . ":{$name}:" . md5(json_encode($params));

        return Cache::remember($key, $seconds, $build);
    }

    /**
     * @param  array{label?: ?string, asset?: ?string, impact?: ?string, range?: ?string, sort?: ?string, cursor?: ?string}  $filters
     * @return array{items: array<int, array>, nextCursor: ?string}
     */
    public static function stories(array $filters): array
    {
        $hours = self::RANGES[$filters['range'] ?? self::DEFAULT_RANGE] ?? self::RANGES[self::DEFAULT_RANGE];

        $query = NewsCluster::with(['primaryArticle', 'articles'])
            ->whereNotNull('primary_article_id')
            ->where('trader_relevance', '>=', (int) config('news.min_relevance'))
            ->where('latest_published_at', '>=', CarbonImmutable::now()->subHours($hours));

        if ($label = $filters['label'] ?? null) {
            // Sentiment filters only make sense for analyzed stories.
            $query->where('analysis_status', NewsCluster::STATUS_ANALYZED)->where('label', $label);
        }

        if ($asset = $filters['asset'] ?? null) {
            $query->whereJsonContains('assets', $asset);
        }

        if ($impact = $filters['impact'] ?? null) {
            $query->where('impact', $impact);
        }

        if (($filters['sort'] ?? 'latest') === 'impact') {
            $query->orderByDesc('impact_rank')->orderByDesc('trader_relevance');
        }

        $page = $query
            ->orderByDesc('latest_published_at')
            ->orderByDesc('id')
            ->cursorPaginate(self::PER_PAGE, ['*'], 'cursor', $filters['cursor'] ?? null);

        return [
            'items' => $page->getCollection()->map(fn (NewsCluster $cluster) => self::present($cluster))->values()->all(),
            'nextCursor' => $page->nextCursor()?->encode(),
        ];
    }

    public static function story(string $clusterId): ?array
    {
        $cluster = NewsCluster::with(['primaryArticle', 'articles'])
            ->whereNotNull('primary_article_id')
            ->find($clusterId);

        return $cluster ? self::present($cluster) : null;
    }

    public static function global(): array
    {
        $snapshot = NewsSentimentSnapshot::latest('id')->first();
        $batch = NewsBatch::where('status', 'published')->latest('id')->first();
        $market = MarketData::remember('market_global') ?? $snapshot?->market;
        $since = CarbonImmutable::now()->subHours(24);

        $recent = NewsCluster::where('trader_relevance', '>=', (int) config('news.min_relevance'))
            ->where('latest_published_at', '>=', $since)
            ->get(['tags', 'analysis_status']);

        return [
            'sentiment' => $snapshot ? self::split($snapshot) : null,
            'label' => $snapshot?->label,
            'aiSummary' => $snapshot?->ai_summary,
            'byAsset' => $snapshot?->by_asset ?? [],
            'sentimentStoryCount' => $snapshot?->story_count ?? 0,
            'sentimentUpdatedAt' => $snapshot?->created_at?->toIso8601ZuluString(),
            'market' => $market ? [
                'totalMarketCapUsd' => (float) ($market['market_cap'] ?? 0),
                'marketCapChange24hPct' => (float) ($market['change_24h'] ?? 0),
                'btcDominancePct' => (float) ($market['btc_dominance'] ?? 0),
                'totalVolumeUsd' => (float) ($market['volume_24h'] ?? 0),
            ] : null,
            'trendingTags' => $recent
                ->flatMap(fn (NewsCluster $cluster) => $cluster->tags)
                ->countBy()
                ->sortDesc()
                ->take(self::TRENDING_TAGS)
                ->map(fn (int $count, string $tag) => ['tag' => $tag, 'count' => $count])
                ->values()
                ->all(),
            'storiesLast24h' => $recent->count(),
            'analyzedLast24h' => $recent->where('analysis_status', NewsCluster::STATUS_ANALYZED)->count(),
            'updatedAt' => $batch?->finished_at?->toIso8601ZuluString(),
            'nextUpdateAt' => ($batch?->next_update_at ?? NewsSchedule::nextRunAfter(now()))->toIso8601ZuluString(),
        ];
    }

    /**
     * @return array<int, array{at: string, bullish: int, bearish: int, neutral: int, label: string}>
     */
    public static function trend(int $days): array
    {
        return NewsSentimentSnapshot::where('created_at', '>=', CarbonImmutable::now()->subDays($days))
            ->orderBy('created_at')
            ->get()
            ->map(fn (NewsSentimentSnapshot $snapshot) => [
                'at' => $snapshot->created_at->toIso8601ZuluString(),
                ...self::split($snapshot),
                'label' => $snapshot->label,
            ])
            ->all();
    }

    public static function present(NewsCluster $cluster): array
    {
        $primary = $cluster->primaryArticle;
        $analyzed = $cluster->analysis_status === NewsCluster::STATUS_ANALYZED;

        return [
            'clusterId' => $cluster->id,
            'headline' => $primary->title,
            'url' => $primary->url,
            'source' => $primary->source_name,
            'publishedAt' => $primary->published_at->toIso8601ZuluString(),
            'sourceIcon' => NewsIcons::forArticle($primary),
            // Primary article's thumbnail, else any other outlet's.
            'imageUrl' => $primary->image_url
                ?? $cluster->articles->first(fn (NewsArticle $article) => $article->image_url !== null)?->image_url,
            'summary' => $analyzed ? $cluster->summary : null,
            // The feed's own short description, only for unanalyzed stories.
            'snippet' => $analyzed ? null : $primary->snippet,
            'analyzed' => $analyzed,
            'sentiment' => $analyzed ? [
                'bullish' => $cluster->sentiment_bullish,
                'bearish' => $cluster->sentiment_bearish,
                'neutral' => $cluster->sentiment_neutral,
            ] : null,
            'label' => $analyzed ? $cluster->label : null,
            'impact' => $cluster->impact ?? 'low',
            'confidence' => $analyzed ? ($cluster->confidence ?? 'low') : 'low',
            'assets' => $cluster->assets ?? [],
            'tags' => $cluster->tags ?? [],
            'traderTake' => $analyzed && $cluster->take_teaser ? [
                'teaser' => $cluster->take_teaser,
                'view' => $cluster->take_view ?? '',
            ] : null,
            'relevance' => $cluster->trader_relevance,
            'related' => $cluster->articles
                ->reject(fn (NewsArticle $article) => $article->id === $primary->id)
                ->sortBy('published_at')
                ->map(fn (NewsArticle $article) => [
                    'source' => $article->source_name,
                    'sourceIcon' => NewsIcons::forArticle($article),
                    'headline' => $article->title,
                    'url' => $article->url,
                    'imageUrl' => $article->image_url,
                    'publishedAt' => $article->published_at->toIso8601ZuluString(),
                ])
                ->values()
                ->all(),
        ];
    }

    /**
     * @return array{bullish: int, bearish: int, neutral: int}
     */
    private static function split(NewsSentimentSnapshot $snapshot): array
    {
        return [
            'bullish' => $snapshot->bullish,
            'bearish' => $snapshot->bearish,
            'neutral' => $snapshot->neutral,
        ];
    }
}
