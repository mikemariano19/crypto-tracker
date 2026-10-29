<?php

namespace App\Support\News;

use App\Events\NewsBatchPublished;
use App\Models\NewsArticle;
use App\Models\NewsBatch;
use App\Models\NewsCluster;
use App\Support\News\Sources\NewsSource;
use App\Support\News\Sources\NewsSources;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * One news run: fetch → dedupe → cluster → score relevance → pick the top
 * new stories for AI analysis. Everything here is free (no AI calls).
 */
class NewsPipeline
{
    // How far back the first run (or a run after a long gap) looks.
    private const MAX_LOOKBACK_HOURS = 24;

    // Overlap with the previous run, for feeds that publish late.
    private const OVERLAP_MINUTES = 60;

    public function __construct(private RelevanceScorer $scorer) {}

    /**
     * @param  NewsSource[]|null  $sources  defaults to the enabled config sources
     */
    public function run(?array $sources = null): NewsBatch
    {
        $sources ??= NewsSources::enabled();
        $timer = microtime(true);
        $since = $this->since();

        $batch = NewsBatch::create(['status' => 'running', 'started_at' => now()]);
        $errors = [];
        $fetched = [];

        // One source failing must never fail the batch.
        foreach ($sources as $source) {
            try {
                array_push($fetched, ...$source->fetch($since));
            } catch (\Throwable $e) {
                $errors[] = ['source' => $source->key(), 'message' => Str::limit($e->getMessage(), 300)];

                Log::warning('News source failed', ['source' => $source->key(), 'message' => $e->getMessage()]);
            }
        }

        try {
            $new = $this->dedupe($fetched);

            [$touchedIds, $created] = DB::transaction(fn () => $this->cluster($new, $batch));

            $this->refreshClusters($touchedIds);

            $newClusters = NewsCluster::where('batch_id', $batch->id)->get();
            $selected = self::pickTop(
                $newClusters,
                (int) config('news.min_relevance'),
                (int) config('news.max_analyzed_per_run'),
            );

            NewsCluster::whereKey($selected->modelKeys())->update(['analysis_status' => NewsCluster::STATUS_PENDING]);
        } catch (\Throwable $e) {
            $batch->update([
                'status' => 'failed',
                'finished_at' => now(),
                'duration_ms' => (int) ((microtime(true) - $timer) * 1000),
                'errors' => [...$errors, ['stage' => 'pipeline', 'message' => Str::limit($e->getMessage(), 300)]],
            ]);

            throw $e;
        }

        $batch->update([
            'status' => 'published',
            'finished_at' => now(),
            'next_update_at' => NewsSchedule::nextRunAfter(now()),
            'articles_fetched' => count($fetched),
            'articles_new' => count($new),
            'clusters_created' => $created,
            'clusters_kept' => $newClusters->where('trader_relevance', '>=', (int) config('news.min_relevance'))->count(),
            'clusters_selected' => $selected->count(),
            'duration_ms' => (int) ((microtime(true) - $timer) * 1000),
            'errors' => $errors ?: null,
        ]);

        Log::info('News batch finished', $batch->only([
            'id', 'articles_fetched', 'articles_new', 'clusters_created', 'clusters_kept',
            'clusters_selected', 'ai_input_tokens', 'ai_output_tokens', 'duration_ms', 'errors',
        ]));

        // Outlet icons for new hosts (cached; lookups that fail just retry later).
        NewsIcons::warm(array_map(fn (RawArticle $article) => $article->url, $new));

        // Share images for headlines whose feed item had none.
        NewsImages::backfill();

        // Without analyzed stories this keeps the previous snapshot.
        NewsSentiment::snapshot($batch);

        NewsFeed::bumpVersion();

        try {
            broadcast(new NewsBatchPublished($batch->id, $created, $batch->finished_at->toIso8601String()));
        } catch (\Throwable $e) {
            // The page's refresh interval picks the batch up anyway.
            Log::warning('News broadcast failed', ['message' => $e->getMessage()]);
        }

        return $batch;
    }

    /**
     * The highest-relevance clusters at or above the threshold, newest first
     * on ties.
     *
     * @param  Collection<int, NewsCluster>  $clusters
     * @return Collection<int, NewsCluster>
     */
    public static function pickTop(Collection $clusters, int $minRelevance, int $limit): Collection
    {
        return $clusters
            ->filter(fn (NewsCluster $cluster) => $cluster->trader_relevance >= $minRelevance)
            ->sort(fn (NewsCluster $a, NewsCluster $b) =>
                [$b->trader_relevance, $b->latest_published_at?->getTimestamp()]
                <=> [$a->trader_relevance, $a->latest_published_at?->getTimestamp()]
            )
            ->take(max(0, $limit))
            ->values();
    }

    /**
     * Impact for stories the AI hasn't rated, so impact filters and sorting
     * still work on them.
     */
    public static function impactFromRelevance(int $relevance): string
    {
        return match (true) {
            $relevance >= 75 => 'high',
            $relevance >= 55 => 'medium',
            default => 'low',
        };
    }

    private function since(): CarbonImmutable
    {
        $floor = CarbonImmutable::now()->subHours(self::MAX_LOOKBACK_HOURS);

        $lastRun = NewsBatch::where('status', 'published')->latest('started_at')->value('started_at');

        if (!$lastRun) {
            return $floor;
        }

        $since = CarbonImmutable::parse($lastRun)->subMinutes(self::OVERLAP_MINUTES);

        return $since->greaterThan($floor) ? $since : $floor;
    }

    /**
     * Drop articles already stored, or repeated across feeds this run.
     *
     * @param  RawArticle[]  $articles
     * @return RawArticle[]
     */
    private function dedupe(array $articles): array
    {
        $unique = [];

        foreach ($articles as $article) {
            $unique[$article->urlHash()] ??= $article;
        }

        $known = collect(array_keys($unique))
            ->chunk(500)
            ->flatMap(fn (Collection $hashes) => NewsArticle::whereIn('url_hash', $hashes->all())->pluck('url_hash'))
            ->flip();

        return array_values(array_filter(
            $unique,
            fn (RawArticle $article) => !$known->has($article->urlHash())
        ));
    }

    /**
     * Store each article in the most similar recent cluster, or a new one.
     *
     * @param  RawArticle[]  $articles
     * @return array{0: string[], 1: int} touched cluster ids, clusters created
     */
    private function cluster(array $articles, NewsBatch $batch): array
    {
        $threshold = (float) config('news.cluster_similarity');
        $windowSeconds = (int) config('news.cluster_window_hours', 24) * 3600;

        usort($articles, fn (RawArticle $a, RawArticle $b) => $a->publishedAt <=> $b->publishedAt);

        $candidates = NewsArticle::where('published_at', '>=', now()->subSeconds($windowSeconds * 2))
            ->get(['cluster_id', 'title_tokens', 'published_at'])
            ->map(fn (NewsArticle $article) => [
                'cluster_id' => $article->cluster_id,
                'tokens' => $article->title_tokens,
                'time' => $article->published_at->getTimestamp(),
            ])
            ->all();

        $touched = [];
        $created = 0;

        foreach ($articles as $article) {
            $tokens = TitleSimilarity::tokens($article->title);
            $time = $article->publishedAt->getTimestamp();

            $clusterId = null;
            $bestScore = 0.0;

            foreach ($candidates as $candidate) {
                if (abs($candidate['time'] - $time) > $windowSeconds) {
                    continue;
                }

                $similarity = TitleSimilarity::jaccard($tokens, $candidate['tokens']);

                if ($similarity >= $threshold && $similarity > $bestScore) {
                    $clusterId = $candidate['cluster_id'];
                    $bestScore = $similarity;
                }
            }

            if (!$clusterId) {
                $clusterId = NewsCluster::create([
                    'batch_id' => $batch->id,
                    'assets' => [],
                    'tags' => [],
                    'first_published_at' => $article->publishedAt,
                    'latest_published_at' => $article->publishedAt,
                ])->id;

                $created++;
            }

            NewsArticle::create([
                'cluster_id' => $clusterId,
                'source' => $article->source,
                'source_name' => $article->sourceName,
                'url' => $article->url,
                'url_hash' => $article->urlHash(),
                'title' => $article->title,
                'title_tokens' => $tokens,
                'snippet' => $article->snippet,
                'image_url' => $article->imageUrl,
                'credibility' => $article->credibility,
                'published_at' => $article->publishedAt,
            ]);

            $candidates[] = ['cluster_id' => $clusterId, 'tokens' => $tokens, 'time' => $time];
            $touched[$clusterId] = true;
        }

        return [array_keys($touched), $created];
    }

    /**
     * Recompute primary article, source count, dates and relevance for
     * clusters that gained articles.
     *
     * @param  string[]  $clusterIds
     */
    private function refreshClusters(array $clusterIds): void
    {
        NewsCluster::with('articles')->whereKey($clusterIds)->each(function (NewsCluster $cluster) {
            $articles = $cluster->articles;

            // Most credible outlet first, then whoever reported it first.
            $primary = $articles
                ->sort(fn (NewsArticle $a, NewsArticle $b) =>
                    [$b->credibility, $a->published_at->getTimestamp()]
                    <=> [$a->credibility, $b->published_at->getTimestamp()]
                )
                ->first();

            $scored = $this->scorer->score($primary->title, $primary->snippet, $articles->count(), $primary->credibility);

            $updates = [
                'primary_article_id' => $primary->id,
                'source_count' => $articles->count(),
                'trader_relevance' => $scored['score'],
                'first_published_at' => $articles->min('published_at'),
                'latest_published_at' => $articles->max('published_at'),
            ];

            // Once analyzed, assets, tags and impact come from the AI.
            if ($cluster->analysis_status !== NewsCluster::STATUS_ANALYZED) {
                $otherAssets = $articles->flatMap(fn (NewsArticle $article) => $this->scorer->assets($article->title));
                $impact = self::impactFromRelevance($scored['score']);

                $updates['assets'] = collect($scored['assets'])->merge($otherAssets)->unique()->values()->all();
                $updates['tags'] = $scored['tags'];
                $updates['impact'] = $impact;
                $updates['impact_rank'] = NewsSentiment::IMPACT_RANKS[$impact];
            }

            $cluster->update($updates);
        });
    }
}
