<?php

namespace Tests\Feature\Insight;

use App\Models\InsightOutlook;
use App\Models\NewsArticle;
use App\Models\NewsBatch;
use App\Models\NewsCluster;
use App\Services\Insight\ClaudeInsightClient;
use App\Services\Insight\InsightBudget;
use App\Support\News\ClaudeNewsClient;
use App\Support\News\NewsAnalyzer;
use Closure;
use GuzzleHttp\Psr7\Response;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Psr\Http\Client\ClientInterface;
use Psr\Http\Message\RequestInterface;
use Psr\Http\Message\ResponseInterface;
use Tests\TestCase;

/**
 * The real SDK runs against a fake HTTP layer, and CoinGecko is faked too, so
 * nothing here spends credits or calls out.
 */
class PriceInsightApiTest extends TestCase
{
    use RefreshDatabase;

    private FakeInsightApi $api;

    private bool $coinGeckoUp = true;

    protected function setUp(): void
    {
        parent::setUp();

        Cache::flush();
        Http::preventStrayRequests();

        $this->travelTo('2026-11-06 12:00:00');

        // No waiting in tests: a held lock times out straight away.
        config(['news.ai.api_key' => 'test-key', 'insight.lock_wait_seconds' => 0]);

        $this->api = new FakeInsightApi;
        $this->app->instance(ClaudeInsightClient::class, new ClaudeInsightClient($this->api));

        $this->fakeCoinGecko();
    }

    /**
     * 180 candles swinging around 100, so zones and every indicator have data.
     */
    private function fakeCoinGecko(): void
    {
        $now = now()->getTimestamp() * 1000;
        $rows = [];
        $volumes = [];

        for ($i = 0; $i < 180; $i++) {
            $time = $now - (179 - $i) * 14_400_000;
            $middle = 100 + 10 * sin($i / 4);
            $rows[] = [$time, $middle, $middle + 1, $middle - 1, $middle];
            $volumes[] = [$time, 1000 + $i];
        }

        Http::fake(fn (HttpRequest $request) => match (true) {
            !$this->coinGeckoUp => Http::response([], 500),
            str_contains($request->url(), '/ohlc') => Http::response($rows),
            default => Http::response(['prices' => [[$now, 101.5]], 'total_volumes' => $volumes]),
        });
    }

    private function goodAnswer(array $changes = []): Response
    {
        return $this->message('end_turn', [
            ['type' => 'thinking', 'thinking' => '', 'signature' => 'sig'],
            ['type' => 'text', 'text' => json_encode(array_merge([
                'outlook' => ['bullish' => 58, 'neutral' => 27, 'bearish' => 15],
                'confidence' => 'medium',
                'summary' => 'Technicals lean bullish with RSI neutral.',
                'reasons' => ['Trend is up'],
                'watch' => 'A clear move through S1 would change the view.',
            ], $changes))],
        ]);
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
            'usage' => [
                'input_tokens' => 100,
                'output_tokens' => 50,
                'cache_creation_input_tokens' => 0,
                'cache_read_input_tokens' => 0,
            ],
        ]));
    }

    private function sentBody(int $index = 0): array
    {
        return json_decode((string) $this->api->requests[$index]->getBody(), true);
    }

    // ---- Running an analysis ----

    public function test_click_returns_levels_indicators_and_outlook(): void
    {
        $this->api->queue($this->goodAnswer());

        $this->postJson('/api/insight/bitcoin?tf=7d')
            ->assertOk()
            ->assertJsonPath('source', 'analysis')
            ->assertJsonPath('data.coinId', 'bitcoin')
            ->assertJsonPath('data.timeframe', '7d')
            ->assertJsonPath('data.price', 101.5)
            ->assertJsonPath('data.aiStatus', 'ok')
            ->assertJsonPath('data.ai.label', 'bullish')
            ->assertJsonPath('data.ai.outlook.bullish', 58)
            ->assertJsonPath('data.analyzedAt', '2026-11-06T12:00:00Z')
            ->assertJsonPath('data.expiresAt', '2026-11-06T18:00:00Z')
            ->assertJsonStructure(['data' => ['zones', 'ema20', 'ema50', 'rsi', 'rsiLatest', 'volume', 'trend', 'newsPins']]);

        $this->assertCount(1, $this->api->requests);
    }

    public function test_seven_day_analysis_uses_30_days_of_history_and_shows_7(): void
    {
        $this->api->queue($this->goodAnswer());

        $response = $this->postJson('/api/insight/bitcoin?tf=7d')->assertOk();

        Http::assertSent(fn (HttpRequest $request) => str_contains($request->url(), '/ohlc') && $request['days'] === 30);

        // 7 days of 4-hour candles, not the 180 used for the calculation.
        $this->assertCount(43, $response->json('data.rsi'));
        $this->assertNotEmpty($response->json('data.ema50'));
    }

    public function test_seven_day_chart_shows_7_days_and_leaves_the_history_ready_for_analysis(): void
    {
        $chart = $this->getJson('/api/coins/bitcoin/chart?tf=7d')->assertOk();

        // Starts on the same candle as the analysis lines.
        $this->assertCount(43, $chart->json('data.candles'));
        $this->assertCount(43, $chart->json('data.volume'));
        Http::assertSentCount(2);

        $this->api->queue($this->goodAnswer());
        $analysis = $this->postJson('/api/insight/bitcoin?tf=7d')->assertOk()->assertJsonPath('data.aiStatus', 'ok');

        // The click found the history already cached.
        Http::assertSentCount(2);
        $this->assertSame($chart->json('data.candles.0.time'), $analysis->json('data.rsi.0.time'));
    }

    public function test_one_day_levels_are_checked_against_the_cached_month(): void
    {
        // The coin page opens on 7D, which caches the month of candles.
        $this->getJson('/api/coins/bitcoin/chart?tf=7d')->assertOk();
        Http::assertSentCount(2);

        $this->api->queue($this->goodAnswer());
        $response = $this->postJson('/api/insight/bitcoin?tf=1d')->assertOk();

        // Only 1D's own two calls: the month came from the cache.
        Http::assertSentCount(4);
        $this->assertNotEmpty($response->json('data.zones'));

        foreach ($response->json('data.zones') as $zone) {
            $this->assertContains($zone['source'], ['1d', '30d']);
            $this->assertIsBool($zone['confluence']);
        }

        $this->assertArrayHasKey('confluence', $this->sentSummary()['levels'][0]);
    }

    public function test_one_day_fetches_the_month_when_nothing_is_cached(): void
    {
        $this->api->queue($this->goodAnswer());
        $this->postJson('/api/insight/bitcoin?tf=1d')->assertOk();

        Http::assertSentCount(4);
        Http::assertSent(fn (HttpRequest $request) => str_contains($request->url(), '/ohlc') && $request['days'] === 30);
    }

    public function test_one_day_skips_the_month_when_short_on_time(): void
    {
        // Less than the 20 seconds fetching the month needs.
        config(['insight.deadline_seconds' => 15]);

        $this->api->queue($this->goodAnswer());
        $response = $this->postJson('/api/insight/bitcoin?tf=1d')->assertOk()->assertJsonPath('data.aiStatus', 'ok');

        Http::assertSentCount(2);
        $this->assertSame([], array_filter($response->json('data.zones'), fn ($zone) => $zone['source'] !== '1d'));
    }

    public function test_thirty_day_analysis_uses_its_own_month_of_candles(): void
    {
        $this->api->queue($this->goodAnswer());

        $response = $this->postJson('/api/insight/bitcoin?tf=30d')
            ->assertOk()
            ->assertJsonPath('data.timeframe', '30d')
            ->assertJsonPath('data.aiStatus', 'ok')
            ->assertJsonPath('data.expiresAt', '2026-11-07T00:00:00Z');

        // All 180 candles are on screen, so the lines cover all of them that have a value.
        Http::assertSent(fn (HttpRequest $request) => str_contains($request->url(), '/ohlc') && $request['days'] === 30);
        $this->assertCount(180 - 14, $response->json('data.rsi'));
        $this->assertCount(180 - 49, $response->json('data.ema50'));
        $this->assertSame('30d', $this->sentSummary()['timeframe']);
        // Scored against the price a month later.
        $this->assertTrue(InsightOutlook::firstOrFail()->resolve_at->equalTo(now()->addDays(30)));
    }

    public function test_one_day_analysis_has_no_ema50(): void
    {
        $this->api->queue($this->goodAnswer());

        $response = $this->postJson('/api/insight/bitcoin?tf=1d')->assertOk();

        $this->assertSame([], $response->json('data.ema50'));
        $this->assertNull($this->sentSummary()['ema50']);
        Http::assertSent(fn (HttpRequest $request) => str_contains($request->url(), '/ohlc') && $request['days'] === 1);
    }

    private function sentSummary(): array
    {
        return json_decode($this->sentBody()['messages'][0]['content'], true);
    }

    public function test_sends_a_compact_summary_never_raw_candles(): void
    {
        $this->api->queue($this->goodAnswer());

        $this->postJson('/api/insight/bitcoin?tf=7d')->assertOk();

        $body = $this->sentBody();
        $summary = $this->sentSummary();

        $this->assertSame('claude-haiku-5-5', $body['model']);
        $this->assertSame(400, $body['max_tokens']);
        $this->assertSame('json_schema', $body['output_config']['format']['type']);

        $this->assertSame('BTC', $summary['coin']);
        $this->assertSame('usd', $summary['currency']);
        $this->assertSame(240, $summary['candleMinutes']);
        $this->assertSame(101.5, $summary['price']);
        $this->assertNull($summary['news']);
        $this->assertArrayNotHasKey('candles', $summary);
        $this->assertLessThan(2_000, strlen($body['messages'][0]['content']));
    }

    // ---- Accuracy tracking ----

    public function test_a_real_outlook_is_recorded_once_with_the_live_price(): void
    {
        $this->api->queue($this->goodAnswer());

        $this->postJson('/api/insight/bitcoin?tf=7d')->assertOk()->assertJsonPath('data.accuracy', null);
        $this->postJson('/api/insight/bitcoin?tf=7d')->assertOk();

        $outlook = InsightOutlook::sole();

        $this->assertSame('bullish', $outlook->label);
        $this->assertSame(101.5, $outlook->price);
    }

    public function test_no_outlook_means_nothing_to_score(): void
    {
        config(['news.daily_ai_token_budget' => 100]);

        $this->postJson('/api/insight/bitcoin?tf=7d')->assertOk()->assertJsonPath('data.aiStatus', 'budget_paused');

        $this->assertSame(0, InsightOutlook::count());
    }

    public function test_the_score_reaches_the_response_once_there_are_enough(): void
    {
        config(['insight.accuracy.min_sample' => 1]);

        InsightOutlook::create([
            'coin_id' => 'ethereum',
            'timeframe' => '7d',
            'label' => 'bearish',
            'price' => 10,
            'analyzed_at' => now()->subDays(8),
            'resolve_at' => now()->subDay(),
            'resolved_at' => now()->subDay(),
            'matched' => true,
        ]);

        $this->api->queue($this->goodAnswer());

        $this->postJson('/api/insight/bitcoin?tf=7d')
            ->assertOk()
            ->assertJsonPath('data.accuracy', ['matchedPct' => 100, 'sample' => 1, 'days' => 30]);
    }

    // ---- Cache ----

    public function test_second_click_and_other_visitors_cost_no_ai_call(): void
    {
        $this->api->queue($this->goodAnswer());

        $this->postJson('/api/insight/bitcoin?tf=1d')->assertOk()->assertJsonPath('source', 'analysis');
        $this->postJson('/api/insight/bitcoin?tf=1d', [], ['REMOTE_ADDR' => '10.0.0.9'])->assertOk()->assertJsonPath('source', 'cache');
        $this->getJson('/api/insight/bitcoin?tf=1d')->assertOk()->assertJsonPath('source', 'cache');

        $this->assertCount(1, $this->api->requests);
    }

    public function test_get_never_analyzes(): void
    {
        $this->getJson('/api/insight/bitcoin?tf=1d')
            ->assertNotFound()
            ->assertExactJson(['success' => false, 'cached' => false, 'error' => 'No analysis yet.']);

        $this->assertCount(0, $this->api->requests);
        Http::assertNothingSent();
    }

    public function test_timeframes_are_analyzed_separately(): void
    {
        $this->api->queue($this->goodAnswer());
        $this->postJson('/api/insight/bitcoin?tf=1d')->assertOk();

        $this->getJson('/api/insight/bitcoin?tf=7d')->assertNotFound();
        $this->assertCount(1, $this->api->requests);
    }

    public function test_results_expire_after_their_timeframe_ttl(): void
    {
        $this->api->queue($this->goodAnswer());
        $this->api->queue($this->goodAnswer());

        $this->postJson('/api/insight/bitcoin?tf=1d')->assertOk();

        $this->travel(59)->minutes();
        $this->getJson('/api/insight/bitcoin?tf=1d')->assertOk();

        $this->travel(2)->minutes();
        $this->getJson('/api/insight/bitcoin?tf=1d')->assertNotFound();

        $this->postJson('/api/insight/bitcoin?tf=1d')->assertOk()->assertJsonPath('source', 'analysis');
        $this->assertCount(2, $this->api->requests);
    }

    // ---- Concurrency ----

    public function test_a_click_during_a_running_analysis_causes_no_second_ai_call(): void
    {
        $during = null;

        // A second visitor clicks while the first analysis is waiting on Claude.
        $this->api->beforeResponding = function () use (&$during) {
            $during = $this->postJson('/api/insight/bitcoin?tf=1d', [], ['REMOTE_ADDR' => '10.0.0.9']);
        };
        $this->api->queue($this->goodAnswer());

        $this->postJson('/api/insight/bitcoin?tf=1d')->assertOk();

        $during->assertStatus(503)->assertHeader('Retry-After');
        $this->assertCount(1, $this->api->requests);

        // Once it's done, the waiting visitor's retry gets the same result.
        $this->postJson('/api/insight/bitcoin?tf=1d', [], ['REMOTE_ADDR' => '10.0.0.9'])
            ->assertOk()
            ->assertJsonPath('source', 'cache');
        $this->assertCount(1, $this->api->requests);
    }

    public function test_the_lock_is_released_after_a_failed_analysis(): void
    {
        $this->api->queue(new Response(400, ['Content-Type' => 'application/json'], '{"type":"error","error":{"type":"invalid_request_error","message":"no"}}'));

        $this->postJson('/api/insight/bitcoin?tf=1d')->assertOk()->assertJsonPath('data.aiStatus', 'unavailable');

        $this->assertTrue(Cache::lock('insight:lock:bitcoin:1d', 1)->get());
    }

    // ---- AI failures ----

    public function test_ai_error_still_returns_levels_and_indicators(): void
    {
        $this->api->queue(new Response(400, ['Content-Type' => 'application/json'], '{"type":"error","error":{"type":"invalid_request_error","message":"no"}}'));

        $this->postJson('/api/insight/bitcoin?tf=7d')
            ->assertOk()
            ->assertJsonPath('data.aiStatus', 'unavailable')
            ->assertJsonPath('data.ai', null)
            ->assertJsonPath('data.expiresAt', '2026-11-06T12:10:00Z')
            ->assertJsonStructure(['data' => ['zones', 'ema20', 'rsi']]);
    }

    public function test_the_sdk_does_not_retry_while_a_visitor_waits(): void
    {
        $this->api->queue(new Response(500, ['Content-Type' => 'application/json'], '{"type":"error","error":{"type":"api_error","message":"boom"}}'));
        $this->api->queue($this->goodAnswer());

        $this->postJson('/api/insight/bitcoin?tf=7d')->assertOk()->assertJsonPath('data.aiStatus', 'unavailable');

        $this->assertCount(1, $this->api->requests);
    }

    // ---- Time limit ----

    public function test_no_time_left_skips_the_ai_and_caches_nothing(): void
    {
        config(['insight.deadline_seconds' => 0]);

        $this->postJson('/api/insight/bitcoin?tf=7d')
            ->assertOk()
            ->assertJsonPath('data.aiStatus', 'unavailable')
            ->assertJsonPath('data.ai', null)
            // Already expired, so the visitor gets "Refresh analysis".
            ->assertJsonPath('data.expiresAt', '2026-11-06T12:00:00Z')
            ->assertJsonStructure(['data' => ['zones', 'ema20', 'rsi']]);

        $this->assertCount(0, $this->api->requests);
        $this->getJson('/api/insight/bitcoin?tf=7d')->assertNotFound();

        // The retry has the market data cached and time for the AI.
        config(['insight.deadline_seconds' => 25]);
        $this->api->queue($this->goodAnswer());

        $this->postJson('/api/insight/bitcoin?tf=7d')
            ->assertOk()
            ->assertJsonPath('source', 'analysis')
            ->assertJsonPath('data.aiStatus', 'ok');

        $this->assertCount(1, $this->api->requests);
        Http::assertSentCount(2);
    }

    public function test_the_second_attempt_is_skipped_when_time_is_short(): void
    {
        $this->api->queue($this->goodAnswer(['summary' => 'Price holds above $80,000.']));
        $this->api->queue($this->goodAnswer());
        // Stands in for the first call using up most of the time.
        $this->api->beforeResponding = fn () => config(['insight.min_ai_seconds' => 1000]);

        $this->postJson('/api/insight/bitcoin?tf=7d')
            ->assertOk()
            ->assertJsonPath('data.aiStatus', 'unavailable')
            ->assertJsonPath('data.expiresAt', '2026-11-06T12:00:00Z');

        $this->assertCount(1, $this->api->requests);
        $this->getJson('/api/insight/bitcoin?tf=7d')->assertNotFound();
    }

    public function test_no_api_key_skips_the_ai(): void
    {
        config(['news.ai.api_key' => null]);

        $this->postJson('/api/insight/bitcoin?tf=7d')->assertOk()->assertJsonPath('data.aiStatus', 'unavailable');

        $this->assertCount(0, $this->api->requests);
    }

    public function test_invalid_answer_is_retried_once(): void
    {
        $this->api->queue($this->goodAnswer(['summary' => 'Price holds above $80,000.']));
        $this->api->queue($this->goodAnswer());

        $this->postJson('/api/insight/bitcoin?tf=7d')->assertOk()->assertJsonPath('data.aiStatus', 'ok');

        $this->assertCount(2, $this->api->requests);
    }

    public function test_a_second_invalid_answer_gives_up(): void
    {
        $this->api->queue($this->goodAnswer(['summary' => 'Price holds above $80,000.']));
        $this->api->queue($this->message('max_tokens', []));
        $this->api->queue($this->goodAnswer());

        $this->postJson('/api/insight/bitcoin?tf=7d')
            ->assertOk()
            ->assertJsonPath('data.aiStatus', 'unavailable')
            ->assertJsonPath('data.ai', null);

        $this->assertCount(2, $this->api->requests);
    }

    public function test_a_refusal_counts_as_invalid(): void
    {
        $this->api->queue($this->message('refusal', []));
        $this->api->queue($this->goodAnswer());

        $this->postJson('/api/insight/bitcoin?tf=7d')->assertOk()->assertJsonPath('data.aiStatus', 'ok');
    }

    public function test_answer_naming_a_level_outside_the_zones_is_rejected(): void
    {
        $this->api->queue($this->goodAnswer(['watch' => 'A break of R9 would change the view.']));
        $this->api->queue($this->goodAnswer(['watch' => 'A break of R9 would change the view.']));

        $this->postJson('/api/insight/bitcoin?tf=7d')->assertOk()->assertJsonPath('data.aiStatus', 'unavailable');
    }

    // ---- Budget ----

    public function test_exhausted_budget_still_returns_levels_for_a_short_time(): void
    {
        config(['news.daily_ai_token_budget' => 100]);

        $this->postJson('/api/insight/bitcoin?tf=7d')
            ->assertOk()
            ->assertJsonPath('data.aiStatus', 'budget_paused')
            ->assertJsonPath('data.ai', null)
            ->assertJsonPath('data.expiresAt', '2026-11-06T12:10:00Z')
            ->assertJsonStructure(['data' => ['zones', 'ema20']]);

        $this->assertCount(0, $this->api->requests);
    }

    public function test_cached_result_is_still_served_once_the_budget_is_gone(): void
    {
        $this->api->queue($this->goodAnswer());
        $this->postJson('/api/insight/bitcoin?tf=1d')->assertOk();

        config(['news.daily_ai_token_budget' => 0]);

        $this->postJson('/api/insight/bitcoin?tf=1d')->assertOk()->assertJsonPath('data.aiStatus', 'ok');
    }

    public function test_tokens_are_counted_and_retries_included(): void
    {
        $this->api->queue($this->goodAnswer(['summary' => 'Above $80,000.']));
        $this->api->queue($this->goodAnswer());

        $this->postJson('/api/insight/bitcoin?tf=7d')->assertOk();

        $this->assertSame(300, InsightBudget::usedToday());
    }

    public function test_news_tokens_count_against_the_shared_budget(): void
    {
        NewsBatch::create(['status' => 'published', 'started_at' => now(), 'ai_input_tokens' => 59_000, 'ai_output_tokens' => 800]);

        $this->assertFalse(InsightBudget::allowsAnotherCall());

        // With its own budget, the news usage no longer counts.
        config(['insight.daily_ai_token_budget' => 1_000]);
        $this->assertTrue(InsightBudget::allowsAnotherCall());
    }

    public function test_insight_tokens_count_against_the_news_budget(): void
    {
        $news = new FakeInsightApi;
        $this->app->instance(ClaudeNewsClient::class, new ClaudeNewsClient($news));
        $this->newsStory();

        config(['news.daily_ai_token_budget' => 7_000, 'news.ai.max_output_tokens' => 6_000]);
        InsightBudget::record(1_001);

        app(NewsAnalyzer::class)->analyzePending(NewsBatch::create(['status' => 'published', 'started_at' => now()]));

        $this->assertCount(0, $news->requests);
    }

    public function test_budget_counter_starts_over_the_next_day(): void
    {
        InsightBudget::record(500);
        $this->assertSame(500, InsightBudget::usedToday());

        $this->travel(1)->days();
        $this->assertSame(0, InsightBudget::usedToday());
    }

    // ---- News ----

    private function newsStory(string $title = 'SEC approves spot Bitcoin product', string $status = NewsCluster::STATUS_PENDING, array $assets = ['BTC'], ?string $at = null): NewsCluster
    {
        $cluster = NewsCluster::create([
            'batch_id' => NewsBatch::create(['status' => 'published', 'started_at' => now()])->id,
            'assets' => $assets,
            'tags' => [],
            'trader_relevance' => 80,
            'analysis_status' => $status,
            'first_published_at' => $at ?? now()->subHours(2),
            'latest_published_at' => $at ?? now()->subHours(2),
            'sentiment_bullish' => 70,
            'sentiment_bearish' => 10,
            'sentiment_neutral' => 20,
            'label' => 'bullish',
        ]);

        $article = NewsArticle::create([
            'cluster_id' => $cluster->id,
            'source' => 'test',
            'source_name' => 'Test News',
            'url' => 'https://news.test/story',
            'url_hash' => md5($title),
            'title' => $title,
            'title_tokens' => [],
            'credibility' => 0.9,
            'published_at' => $at ?? now()->subHours(2),
        ]);

        $cluster->update(['primary_article_id' => $article->id]);

        return $cluster;
    }

    public function test_coin_news_goes_to_the_ai_and_becomes_pins(): void
    {
        $this->newsStory(status: NewsCluster::STATUS_ANALYZED);
        $this->api->queue($this->goodAnswer());

        $this->postJson('/api/insight/bitcoin?tf=1d')
            ->assertOk()
            ->assertJsonPath('data.newsPins.0.headline', 'SEC approves spot Bitcoin product')
            ->assertJsonPath('data.newsPins.0.url', 'https://news.test/story')
            ->assertJsonPath('data.newsPins.0.source', 'Test News')
            ->assertJsonPath('data.newsPins.0.label', 'bullish');

        $news = $this->sentSummary()['news'];
        $this->assertSame(1, $news['storyCount']);
        $this->assertSame(['bullish' => 70, 'neutral' => 20, 'bearish' => 10], $news['sentiment']);
        $this->assertSame(['SEC approves spot Bitcoin product'], $news['topHeadlines']);
    }

    public function test_only_this_coins_analyzed_recent_stories_count(): void
    {
        $this->newsStory('Not analyzed', NewsCluster::STATUS_PENDING);
        $this->newsStory('Other coin', NewsCluster::STATUS_ANALYZED, ['ETH']);
        $this->newsStory('Too old for 1D', NewsCluster::STATUS_ANALYZED, ['BTC'], now()->subHours(30)->toDateTimeString());
        $this->api->queue($this->goodAnswer());

        $this->postJson('/api/insight/bitcoin?tf=1d')->assertOk()->assertJsonCount(0, 'data.newsPins');

        $this->assertNull($this->sentSummary()['news']);
    }

    public function test_seven_day_analysis_reaches_older_stories(): void
    {
        $this->newsStory('Three days old', NewsCluster::STATUS_ANALYZED, ['BTC'], now()->subDays(3)->toDateTimeString());
        $this->api->queue($this->goodAnswer());

        $this->postJson('/api/insight/bitcoin?tf=7d')->assertOk()->assertJsonCount(1, 'data.newsPins');
    }

    // ---- Requests ----

    public function test_coins_outside_the_list_are_rejected(): void
    {
        $this->postJson('/api/insight/tether?tf=1d')->assertForbidden()->assertJsonPath('success', false);
        $this->getJson('/api/insight/tether?tf=1d')->assertNotFound();

        $this->assertCount(0, $this->api->requests);
        Http::assertNothingSent();
    }

    public function test_bad_input_is_rejected(): void
    {
        $this->postJson('/api/insight/bitcoin?tf=90d')->assertStatus(422);
        $this->postJson('/api/insight/bad%20id')->assertStatus(422);
        $this->getJson('/api/insight/bitcoin?tf=1y')->assertStatus(422);

        Http::assertNothingSent();
    }

    public function test_rate_limits_per_minute_and_per_hour(): void
    {
        $this->api->queue($this->goodAnswer());

        for ($i = 0; $i < 10; $i++) {
            $this->postJson('/api/insight/bitcoin?tf=1d')->assertOk();
        }

        $this->postJson('/api/insight/bitcoin?tf=1d')
            ->assertStatus(429)
            ->assertHeader('Retry-After')
            ->assertJsonPath('success', false)
            ->assertJsonStructure(['error', 'retryAfter']);

        // Someone else isn't affected, and reads aren't limited by it.
        $this->postJson('/api/insight/bitcoin?tf=1d', [], ['REMOTE_ADDR' => '10.0.0.9'])->assertOk();
        $this->getJson('/api/insight/bitcoin?tf=1d')->assertOk();

        for ($minute = 1; $minute <= 5; $minute++) {
            $this->travel(1)->minutes();

            for ($i = 0; $i < 10; $i++) {
                $this->postJson('/api/insight/bitcoin?tf=1d');
            }
        }

        $this->travel(1)->minutes();

        // 60 in the hour are used, though this minute's count is clear.
        $this->postJson('/api/insight/bitcoin?tf=1d')->assertStatus(429);
    }

    public function test_market_data_outage_with_nothing_cached_is_a_503(): void
    {
        $this->coinGeckoUp = false;

        $this->postJson('/api/insight/bitcoin?tf=1d')->assertStatus(503);

        $this->assertCount(0, $this->api->requests);
    }

    public function test_old_market_data_is_not_analyzed(): void
    {
        $this->api->queue($this->goodAnswer());
        $this->getJson('/api/coins/bitcoin/chart?tf=1d')->assertOk();

        $this->travel(31)->minutes();
        $this->coinGeckoUp = false;

        // The stale chart is still fine to show, but not to base new analysis on.
        $this->getJson('/api/coins/bitcoin/chart?tf=1d')->assertOk()->assertJsonPath('stale', true);
        $this->postJson('/api/insight/bitcoin?tf=1d')->assertStatus(503);

        $this->assertCount(0, $this->api->requests);
    }
}

class FakeInsightApi implements ClientInterface
{
    /** @var RequestInterface[] */
    public array $requests = [];

    public ?Closure $beforeResponding = null;

    /** @var ResponseInterface[] */
    private array $responses = [];

    public function queue(ResponseInterface $response): void
    {
        $this->responses[] = $response;
    }

    public function sendRequest(RequestInterface $request): ResponseInterface
    {
        $this->requests[] = $request;

        if ($callback = $this->beforeResponding) {
            $this->beforeResponding = null;
            $callback();
        }

        return array_shift($this->responses) ?? new Response(500, [], 'No fake response queued');
    }
}
