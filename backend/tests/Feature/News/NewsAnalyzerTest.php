<?php

namespace Tests\Feature\News;

use App\Models\NewsArticle;
use App\Models\NewsBatch;
use App\Models\NewsCluster;
use App\Support\News\ClaudeNewsClient;
use App\Support\News\NewsAnalyzer;
use Carbon\CarbonImmutable;
use GuzzleHttp\Psr7\Response;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Psr\Http\Client\ClientInterface;
use Psr\Http\Message\RequestInterface;
use Psr\Http\Message\ResponseInterface;
use Tests\TestCase;

/**
 * Runs the real SDK against a fake HTTP layer, so request and response
 * handling are covered without spending credits.
 */
class NewsAnalyzerTest extends TestCase
{
    use RefreshDatabase;

    private FakeClaudeApi $api;

    protected function setUp(): void
    {
        parent::setUp();

        CarbonImmutable::setTestNow('2026-10-29 12:00:00');
        $this->travelTo('2026-10-29 12:00:00');

        config(['news.ai.api_key' => 'test-key']);

        $this->api = new FakeClaudeApi;
        $this->app->instance(ClaudeNewsClient::class, new ClaudeNewsClient($this->api));
    }

    public function test_stores_analysis_and_returns_market_summary(): void
    {
        $cluster = $this->story('SEC approves first spot Solana ETF');
        $this->api->queue($this->answer([$this->analysis('1', ['bullish' => 70, 'bearish' => 10, 'neutral' => 20])], 'Risk appetite improved.'));

        $batch = $this->batch();
        $summary = app(NewsAnalyzer::class)->analyzePending($batch);

        $cluster->refresh();
        $this->assertSame('Risk appetite improved.', $summary);
        $this->assertSame(NewsCluster::STATUS_ANALYZED, $cluster->analysis_status);
        $this->assertSame('bullish', $cluster->label);
        $this->assertSame(70, $cluster->sentiment_bullish);
        $this->assertSame('high', $cluster->impact);
        $this->assertSame(3, $cluster->impact_rank);
        $this->assertSame(['SOL'], $cluster->assets);
        $this->assertSame($batch->id, $cluster->analyzed_batch_id);

        $batch->refresh();
        $this->assertSame(1, $batch->ai_requests);
        $this->assertSame(1, $batch->clusters_analyzed);
        $this->assertSame(100, $batch->ai_input_tokens);
        $this->assertSame(50, $batch->ai_output_tokens);
    }

    public function test_sends_feed_text_with_the_configured_model_and_schema(): void
    {
        $this->story('SEC approves first spot Solana ETF');
        $this->api->queue($this->answer([$this->analysis('1')]));

        app(NewsAnalyzer::class)->analyzePending($this->batch());

        $body = json_decode((string) $this->api->requests[0]->getBody(), true);
        $content = json_decode($body['messages'][0]['content'], true);

        $this->assertSame('claude-haiku-5-5', $body['model']);
        $this->assertSame('json_schema', $body['output_config']['format']['type']);
        $this->assertSame('low', $body['output_config']['effort']);
        $this->assertSame('SEC approves first spot Solana ETF', $content['stories'][0]['headline']);
        $this->assertArrayNotHasKey('url', $content['stories'][0]);
    }

    public function test_recomputes_label_and_percentages_from_the_numbers(): void
    {
        $cluster = $this->story('Bitcoin drops');
        $this->api->queue($this->answer([$this->analysis('1', ['bullish' => 10, 'bearish' => 60, 'neutral' => 10])]));

        app(NewsAnalyzer::class)->analyzePending($this->batch());

        $cluster->refresh();
        $this->assertSame('bearish', $cluster->label);
        $this->assertSame(100, $cluster->sentiment_bullish + $cluster->sentiment_bearish + $cluster->sentiment_neutral);
    }

    public function test_trims_text_to_column_limits_and_cleans_assets(): void
    {
        $cluster = $this->story('Bitcoin rises');
        $this->api->queue($this->answer([$this->analysis('1', [
            'summary' => str_repeat('a', 400),
            'take_teaser' => str_repeat('b', 400),
            'take_view' => str_repeat('c', 400),
            'assets' => ['btc', 'BTC', 'not a ticker', 'ETH'],
        ])]));

        app(NewsAnalyzer::class)->analyzePending($this->batch());

        $cluster->refresh();
        $this->assertSame(255, mb_strlen($cluster->summary));
        $this->assertSame(150, mb_strlen($cluster->take_teaser));
        $this->assertSame(300, mb_strlen($cluster->take_view));
        $this->assertSame(['BTC', 'ETH'], $cluster->assets);
    }

    public function test_one_bad_story_does_not_affect_the_others(): void
    {
        $good = $this->story('Bitcoin ETF inflows rise', relevance: 90);
        $bad = $this->story('Ethereum upgrade scheduled', relevance: 80);
        $missing = $this->story('Solana outage resolved', relevance: 70);
        $this->api->queue($this->answer([
            $this->analysis('1'),
            $this->analysis('2', ['bullish' => 0, 'bearish' => 0, 'neutral' => 0]),
        ]));

        app(NewsAnalyzer::class)->analyzePending($this->batch());

        $this->assertSame(NewsCluster::STATUS_ANALYZED, $good->refresh()->analysis_status);
        $this->assertSame(NewsCluster::STATUS_FAILED, $bad->refresh()->analysis_status);
        $this->assertSame(NewsCluster::STATUS_FAILED, $missing->refresh()->analysis_status);
    }

    public function test_splits_stories_when_an_answer_is_refused_and_fails_only_the_cause(): void
    {
        $first = $this->story('Bitcoin ETF inflows rise', relevance: 90);
        $second = $this->story('Exchange hacked for millions', relevance: 80);
        $this->api->queue($this->stopped('refusal'));
        $this->api->queue($this->answer([$this->analysis('1')], 'Summary from the split.'));
        $this->api->queue($this->stopped('refusal'));

        $batch = $this->batch();
        $summary = app(NewsAnalyzer::class)->analyzePending($batch);

        $this->assertCount(3, $this->api->requests);
        $this->assertSame('Summary from the split.', $summary);
        $this->assertSame(NewsCluster::STATUS_ANALYZED, $first->refresh()->analysis_status);
        $this->assertSame(NewsCluster::STATUS_FAILED, $second->refresh()->analysis_status);
        $this->assertSame(3, $batch->refresh()->ai_requests);
    }

    public function test_splits_stories_when_an_answer_is_cut_off(): void
    {
        $first = $this->story('Bitcoin ETF inflows rise', relevance: 90);
        $second = $this->story('Ethereum upgrade scheduled', relevance: 80);
        $this->api->queue($this->stopped('max_tokens'));
        $this->api->queue($this->answer([$this->analysis('1')]));
        $this->api->queue($this->answer([$this->analysis('1')]));

        app(NewsAnalyzer::class)->analyzePending($this->batch());

        $this->assertSame(NewsCluster::STATUS_ANALYZED, $first->refresh()->analysis_status);
        $this->assertSame(NewsCluster::STATUS_ANALYZED, $second->refresh()->analysis_status);
    }

    public function test_api_errors_leave_stories_pending_and_are_recorded(): void
    {
        $cluster = $this->story('Bitcoin rises');
        $this->api->queue(new Response(401, ['Content-Type' => 'application/json'], json_encode([
            'type' => 'error',
            'error' => ['type' => 'authentication_error', 'message' => 'invalid x-api-key'],
        ])));

        $batch = $this->batch();
        $summary = app(NewsAnalyzer::class)->analyzePending($batch);

        $this->assertNull($summary);
        $this->assertSame(NewsCluster::STATUS_PENDING, $cluster->refresh()->analysis_status);
        $this->assertSame('ai', $batch->refresh()->errors[0]['stage']);
    }

    public function test_does_nothing_without_an_api_key(): void
    {
        config(['news.ai.api_key' => null]);
        $cluster = $this->story('Bitcoin rises');

        app(NewsAnalyzer::class)->analyzePending($this->batch());

        $this->assertSame([], $this->api->requests);
        $this->assertSame(NewsCluster::STATUS_PENDING, $cluster->refresh()->analysis_status);
    }

    public function test_stops_at_the_daily_token_budget(): void
    {
        config(['news.daily_ai_token_budget' => 10_000]);
        NewsBatch::create(['status' => 'published', 'started_at' => now(), 'ai_input_tokens' => 4_000, 'ai_output_tokens' => 1_000]);
        $cluster = $this->story('Bitcoin rises');

        app(NewsAnalyzer::class)->analyzePending($this->batch());

        $this->assertSame([], $this->api->requests);
        $this->assertSame(NewsCluster::STATUS_PENDING, $cluster->refresh()->analysis_status);
    }

    public function test_analyzes_only_the_top_stories_above_the_relevance_floor(): void
    {
        config(['news.max_analyzed_per_run' => 1]);
        $top = $this->story('Bitcoin ETF inflows rise', relevance: 90);
        $next = $this->story('Ethereum upgrade scheduled', relevance: 80);
        $low = $this->story('Minor token listed', relevance: 10);
        $this->api->queue($this->answer([$this->analysis('1')]));

        app(NewsAnalyzer::class)->analyzePending($this->batch());

        $this->assertSame(NewsCluster::STATUS_ANALYZED, $top->refresh()->analysis_status);
        $this->assertSame(NewsCluster::STATUS_PENDING, $next->refresh()->analysis_status);
        $this->assertSame(NewsCluster::STATUS_PENDING, $low->refresh()->analysis_status);
    }

    public function test_stories_too_old_for_the_feed_are_skipped_without_a_request(): void
    {
        $old = $this->story('Old news', publishedAt: CarbonImmutable::now()->subDays(4));

        app(NewsAnalyzer::class)->analyzePending($this->batch());

        $this->assertSame([], $this->api->requests);
        $this->assertSame(NewsCluster::STATUS_SKIPPED, $old->refresh()->analysis_status);
    }

    public function test_analyze_recent_includes_skipped_stories_but_not_analyzed_ones(): void
    {
        $skipped = $this->story('Bitcoin rises', status: NewsCluster::STATUS_SKIPPED);
        $done = $this->story('Ethereum falls', status: NewsCluster::STATUS_ANALYZED);
        $this->api->queue($this->answer([$this->analysis('1')]));

        app(NewsAnalyzer::class)->analyzeRecent($this->batch());

        $this->assertCount(1, $this->api->requests);
        $this->assertSame(NewsCluster::STATUS_ANALYZED, $skipped->refresh()->analysis_status);
        $this->assertNull($done->refresh()->analyzed_at);
    }

    private function batch(): NewsBatch
    {
        return NewsBatch::create(['status' => 'published', 'started_at' => now()]);
    }

    private function story(
        string $title,
        int $relevance = 80,
        string $status = NewsCluster::STATUS_PENDING,
        ?CarbonImmutable $publishedAt = null,
    ): NewsCluster {
        $publishedAt ??= CarbonImmutable::now()->subHour();

        $cluster = NewsCluster::create([
            'assets' => ['BTC'],
            'tags' => [],
            'trader_relevance' => $relevance,
            'analysis_status' => $status,
            'first_published_at' => $publishedAt,
            'latest_published_at' => $publishedAt,
        ]);

        $article = NewsArticle::create([
            'cluster_id' => $cluster->id,
            'source' => 'coindesk',
            'source_name' => 'CoinDesk',
            'url' => 'https://coindesk.com/' . md5($title),
            'url_hash' => hash('sha256', $title),
            'title' => $title,
            'title_tokens' => [],
            'snippet' => 'A short description.',
            'credibility' => 1.0,
            'published_at' => $publishedAt,
        ]);

        $cluster->update(['primary_article_id' => $article->id]);

        return $cluster;
    }

    private function analysis(string $id, array $overrides = []): array
    {
        return [
            'id' => $id,
            'bullish' => 50,
            'bearish' => 20,
            'neutral' => 30,
            'impact' => 'high',
            'confidence' => 'medium',
            'assets' => ['SOL'],
            'summary' => 'A summary.',
            'take_teaser' => 'A teaser.',
            'take_view' => 'A view.',
            ...$overrides,
        ];
    }

    private function answer(array $stories, string $summary = 'A market summary.'): Response
    {
        return $this->message('end_turn', [
            ['type' => 'thinking', 'thinking' => '', 'signature' => 'sig'],
            ['type' => 'text', 'text' => json_encode(['stories' => $stories, 'market_summary' => $summary])],
        ]);
    }

    private function stopped(string $reason): Response
    {
        return $this->message($reason, []);
    }

    private function message(string $stopReason, array $content): Response
    {
        return new Response(200, ['Content-Type' => 'application/json'], json_encode([
            'id' => 'msg_test',
            'type' => 'message',
            'role' => 'assistant',
            'model' => 'claude-haiku-5-5',
            'content' => $content,
            'stop_reason' => $stopReason,
            'stop_sequence' => null,
            'usage' => ['input_tokens' => 100, 'output_tokens' => 50],
        ]));
    }
}

class FakeClaudeApi implements ClientInterface
{
    /** @var RequestInterface[] */
    public array $requests = [];

    /** @var ResponseInterface[] */
    private array $responses = [];

    public function queue(ResponseInterface $response): void
    {
        $this->responses[] = $response;
    }

    public function sendRequest(RequestInterface $request): ResponseInterface
    {
        $this->requests[] = $request;

        return array_shift($this->responses) ?? new Response(500, [], 'No fake response queued');
    }
}
