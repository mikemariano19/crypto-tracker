<?php

namespace App\Support\News;

use App\Jobs\FetchNews;
use App\Models\NewsCluster;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * Starts a news fetch when a visitor finds the feed empty, as on a fresh
 * install or after the scheduler has been asleep. The feed is a public GET, so
 * the cooldown is what stops visitors from triggering repeated runs.
 */
class NewsRefresh
{
    private const FETCHING_KEY = 'news:fetching';

    private const COOLDOWN_KEY = 'news:auto-fetch-cooldown';

    // Matches FetchNews::$timeout. If no worker picks the job up, the page
    // stops showing "fetching" after this long.
    private const TTL_SECONDS = 600;

    /**
     * @return bool whether a fetch is under way
     */
    public static function startIfEmpty(): bool
    {
        if (!self::isFeedEmpty()) {
            return self::isFetching();
        }

        if (Cache::add(self::COOLDOWN_KEY, true, self::TTL_SECONDS)) {
            Cache::put(self::FETCHING_KEY, true, self::TTL_SECONDS);

            try {
                FetchNews::dispatch();
            } catch (\Throwable $e) {
                // Reading the feed must still work; the cooldown limits retries.
                self::finished();

                Log::warning('Could not queue news fetch', ['message' => $e->getMessage()]);
            }
        }

        return self::isFetching();
    }

    public static function isFetching(): bool
    {
        return Cache::has(self::FETCHING_KEY);
    }

    public static function finished(): void
    {
        Cache::forget(self::FETCHING_KEY);
    }

    /**
     * Ignores filters: a coin with no stories doesn't mean the feed is empty.
     */
    private static function isFeedEmpty(): bool
    {
        return !NewsCluster::whereNotNull('primary_article_id')
            ->where('trader_relevance', '>=', (int) config('news.min_relevance'))
            ->where('latest_published_at', '>=', CarbonImmutable::now()->subHours(max(NewsFeed::RANGES)))
            ->exists();
    }
}
