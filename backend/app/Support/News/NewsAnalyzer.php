<?php

namespace App\Support\News;

use App\Models\NewsArticle;
use App\Models\NewsBatch;
use App\Models\NewsCluster;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Turns stories into AI sentiment. Never throws: a failed call leaves stories
 * pending for the next run, and the feed keeps working without analysis.
 */
class NewsAnalyzer
{
    // Other outlets' headlines sent per story; more adds cost, not insight.
    private const MAX_RELATED_HEADLINES = 3;

    private const MAX_ASSETS = 5;

    public function __construct(private ClaudeNewsClient $client) {}

    public function isEnabled(): bool
    {
        return $this->client->isConfigured();
    }

    /**
     * Analyze the stories the pipeline marked pending.
     *
     * @return ?string the market summary, when the AI wrote one
     */
    public function analyzePending(NewsBatch $batch): ?string
    {
        if (!$this->isEnabled()) {
            return null;
        }

        // The feed no longer shows these, so analyzing them would waste tokens.
        NewsCluster::where('analysis_status', NewsCluster::STATUS_PENDING)
            ->where('latest_published_at', '<', self::cutoff())
            ->update(['analysis_status' => NewsCluster::STATUS_SKIPPED]);

        return $this->analyze($this->candidates([NewsCluster::STATUS_PENDING]), $batch);
    }

    /**
     * Also analyze stories in the feed that earlier runs left out, such as
     * those from before the AI step was switched on.
     *
     * @return ?string the market summary, when the AI wrote one
     */
    public function analyzeRecent(NewsBatch $batch): ?string
    {
        return $this->analyze($this->candidates([NewsCluster::STATUS_PENDING, NewsCluster::STATUS_SKIPPED]), $batch);
    }

    /**
     * @param  string[]  $statuses
     * @return Collection<int, NewsCluster>
     */
    private function candidates(array $statuses): Collection
    {
        return NewsCluster::with(['primaryArticle', 'articles'])
            ->whereNotNull('primary_article_id')
            ->whereIn('analysis_status', $statuses)
            ->where('trader_relevance', '>=', (int) config('news.min_relevance'))
            ->where('latest_published_at', '>=', self::cutoff())
            ->orderByDesc('trader_relevance')
            ->orderByDesc('latest_published_at')
            ->limit(max(0, (int) config('news.max_analyzed_per_run')))
            ->get();
    }

    /**
     * @param  Collection<int, NewsCluster>  $clusters
     */
    private function analyze(Collection $clusters, NewsBatch $batch): ?string
    {
        if ($clusters->isEmpty()) {
            return null;
        }

        try {
            return $this->analyzeChunk($clusters->values(), $batch);
        } catch (\Throwable $e) {
            Log::warning('News AI analysis failed', ['batch' => $batch->id, 'message' => $e->getMessage()]);

            self::addError($batch, $e->getMessage());

            return null;
        }
    }

    /**
     * A refused or cut-off answer is usually down to one story or too many at
     * once, so split and retry rather than losing every story in the request.
     *
     * @param  Collection<int, NewsCluster>  $clusters
     */
    private function analyzeChunk(Collection $clusters, NewsBatch $batch): ?string
    {
        if (!$this->withinBudget()) {
            Log::warning('News AI daily token budget reached; stories stay pending.', ['batch' => $batch->id]);

            return null;
        }

        $result = $this->client->analyze(
            $clusters->map(fn (NewsCluster $cluster, int $index) => self::storyPayload($cluster, (string) ($index + 1)))->values()->all(),
        );

        // Saved after every call, so the budget stays right if a later one fails.
        $batch->update([
            'ai_requests' => $batch->ai_requests + 1,
            'ai_input_tokens' => $batch->ai_input_tokens + $result['input_tokens'],
            'ai_output_tokens' => $batch->ai_output_tokens + $result['output_tokens'],
        ]);

        if ($result['status'] !== ClaudeNewsClient::STATUS_OK) {
            return $this->retryUnusable($clusters, $batch, (string) $result['reason']);
        }

        $analyses = collect($result['data']['stories'] ?? [])->keyBy(fn ($story) => (string) ($story['id'] ?? ''));

        foreach ($clusters as $index => $cluster) {
            $this->store($cluster, $analyses->get((string) ($index + 1)), $batch);
        }

        return self::text($result['data']['market_summary'] ?? null, 1000);
    }

    /**
     * @param  Collection<int, NewsCluster>  $clusters
     */
    private function retryUnusable(Collection $clusters, NewsBatch $batch, string $reason): ?string
    {
        if ($clusters->count() === 1) {
            // Failed, not pending: retrying it every run would keep spending tokens.
            $clusters->first()->update(['analysis_status' => NewsCluster::STATUS_FAILED]);

            self::addError($batch, "Story {$clusters->first()->id} not analyzed ({$reason})");

            return null;
        }

        $half = (int) ceil($clusters->count() / 2);
        $first = $this->analyzeChunk($clusters->take($half)->values(), $batch);
        $second = $this->analyzeChunk($clusters->skip($half)->values(), $batch);

        return $first ?? $second;
    }

    private function store(NewsCluster $cluster, mixed $analysis, NewsBatch $batch): void
    {
        $values = is_array($analysis) ? self::validated($analysis) : null;

        if (!$values) {
            $cluster->update(['analysis_status' => NewsCluster::STATUS_FAILED]);

            self::addError($batch, "Story {$cluster->id} had an invalid analysis");

            return;
        }

        $cluster->update([
            ...$values,
            'assets' => $values['assets'] ?: $cluster->assets,
            'analysis_status' => NewsCluster::STATUS_ANALYZED,
            'analyzed_batch_id' => $batch->id,
            'analyzed_at' => now(),
        ]);

        $batch->update(['clusters_analyzed' => $batch->clusters_analyzed + 1]);
    }

    /**
     * The schema fixes the shape, not the values, and the columns have hard
     * length limits. Label comes from the numbers so the two can't disagree.
     */
    private static function validated(array $analysis): ?array
    {
        $impact = $analysis['impact'] ?? null;
        $confidence = $analysis['confidence'] ?? null;
        $summary = self::text($analysis['summary'] ?? null, 255);
        $split = [
            max(0, (int) ($analysis['bullish'] ?? 0)),
            max(0, (int) ($analysis['bearish'] ?? 0)),
            max(0, (int) ($analysis['neutral'] ?? 0)),
        ];

        if (
            !$summary
            || array_sum($split) === 0
            || !isset(NewsSentiment::IMPACT_RANKS[$impact])
            || !in_array($confidence, ['low', 'medium', 'high'], true)
        ) {
            return null;
        }

        $sentiment = NewsSentiment::normalize(...$split);

        return [
            'sentiment_bullish' => $sentiment['bullish'],
            'sentiment_bearish' => $sentiment['bearish'],
            'sentiment_neutral' => $sentiment['neutral'],
            'label' => NewsSentiment::label($sentiment),
            'impact' => $impact,
            'impact_rank' => NewsSentiment::IMPACT_RANKS[$impact],
            'confidence' => $confidence,
            'summary' => $summary,
            'take_teaser' => self::text($analysis['take_teaser'] ?? null, 150),
            'take_view' => self::text($analysis['take_view'] ?? null, 300),
            'assets' => collect($analysis['assets'] ?? [])
                ->filter(fn ($asset) => is_string($asset))
                ->map(fn (string $asset) => strtoupper(trim($asset)))
                ->filter(fn (string $asset) => preg_match('/^[A-Z0-9]{2,10}$/', $asset) === 1)
                ->unique()
                ->take(self::MAX_ASSETS)
                ->values()
                ->all(),
        ];
    }

    /**
     * Only feed text goes in. Links, sources and credibility are never sent
     * back from the AI, so it can't invent them.
     */
    private static function storyPayload(NewsCluster $cluster, string $id): array
    {
        $primary = $cluster->primaryArticle;

        return [
            'id' => $id,
            'headline' => $primary->title,
            'description' => $primary->snippet,
            'outlet' => $primary->source_name,
            'outlets_reporting' => $cluster->articles->pluck('source_name')->unique()->count(),
            'published_at' => $primary->published_at->toIso8601ZuluString(),
            'other_headlines' => $cluster->articles
                ->reject(fn (NewsArticle $article) => $article->id === $primary->id)
                ->take(self::MAX_RELATED_HEADLINES)
                ->pluck('title')
                ->values()
                ->all(),
        ];
    }

    /**
     * Reserves a full response, so the last request can't overshoot by much.
     */
    private function withinBudget(): bool
    {
        $used = NewsBatch::where('started_at', '>=', CarbonImmutable::now()->startOfDay())
            ->selectRaw('COALESCE(SUM(ai_input_tokens + ai_output_tokens), 0) as total')
            ->value('total');

        return (int) $used + (int) config('news.ai.max_output_tokens') <= (int) config('news.daily_ai_token_budget');
    }

    private static function cutoff(): CarbonImmutable
    {
        return CarbonImmutable::now()->subHours(max(NewsFeed::RANGES));
    }

    private static function text(mixed $value, int $maxChars): ?string
    {
        if (!is_string($value)) {
            return null;
        }

        $text = trim(strip_tags($value));

        if ($text === '') {
            return null;
        }

        return mb_strlen($text) > $maxChars ? rtrim(mb_substr($text, 0, $maxChars - 1)) . '…' : $text;
    }

    private static function addError(NewsBatch $batch, string $message): void
    {
        $batch->update(['errors' => [
            ...($batch->errors ?? []),
            ['stage' => 'ai', 'message' => Str::limit($message, 300)],
        ]]);
    }
}
