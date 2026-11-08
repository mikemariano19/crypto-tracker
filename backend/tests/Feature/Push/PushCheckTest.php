<?php

namespace Tests\Feature\Push;

use App\Models\NewsArticle;
use App\Models\NewsBatch;
use App\Models\NewsCluster;
use App\Models\NewsSentimentSnapshot;
use App\Models\PriceAlert;
use App\Models\PushNotification;
use App\Models\PushSubscription;
use App\Services\Insight\ChartData;
use App\Support\MarketData;
use App\Support\Push\PushCheck;
use App\Support\Push\PushSender;
use App\Support\StaleCache;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * CoinGecko is faked and pushes are recorded, so nothing here calls out.
 */
class PushCheckTest extends TestCase
{
    use RefreshDatabase;

    private FakePushSender $sender;

    /** @var array<string, float> coin => USD price */
    private array $prices = ['bitcoin' => 70_000, 'ethereum' => 2_500, 'solana' => 150];

    private float $market24h = 1.2;

    private bool $upstreamUp = true;

    private int $endpoints = 0;

    protected function setUp(): void
    {
        parent::setUp();

        Cache::flush();
        Http::preventStrayRequests();

        // 04:00 UTC is noon in Manila: outside the default quiet hours.
        $this->travelTo('2026-11-08 04:00:00');

        $this->sender = new FakePushSender;
        $this->app->instance(PushSender::class, $this->sender);

        Http::fake(function (Request $request) {
            $url = $request->url();

            return match (true) {
                !$this->upstreamUp => Http::response([], 500),
                str_contains($url, '/simple/price') => Http::response(collect($this->prices)
                    ->map(fn (float $usd) => ['usd' => $usd, 'php' => $usd * 58, 'last_updated_at' => now()->getTimestamp()])
                    ->all()),
                // CoinGecko's rates are per BTC; the API turns them into per USD.
                str_contains($url, '/exchange_rates') => Http::response(['rates' => [
                    'usd' => ['name' => 'US Dollar', 'unit' => '$', 'value' => 100_000, 'type' => 'fiat'],
                    'php' => ['name' => 'Philippine Peso', 'unit' => '₱', 'value' => 5_800_000, 'type' => 'fiat'],
                ]]),
                str_contains($url, '/global') => Http::response(['data' => [
                    'total_market_cap' => ['usd' => 3e12],
                    'total_volume' => ['usd' => 1e11],
                    'market_cap_percentage' => ['btc' => 55, 'eth' => 12],
                    'market_cap_change_percentage_24h_usd' => $this->market24h,
                    'active_cryptocurrencies' => 10_000,
                ]]),
                str_contains($url, '/coins/markets') => Http::response([
                    ['id' => 'bitcoin', 'symbol' => 'btc', 'name' => 'Bitcoin', 'current_price' => 70_000, 'price_change_percentage_24h' => -5.8],
                    ['id' => 'ethereum', 'symbol' => 'eth', 'name' => 'Ethereum', 'current_price' => 2_500, 'price_change_percentage_24h' => -7.2],
                    ['id' => 'solana', 'symbol' => 'sol', 'name' => 'Solana', 'current_price' => 150, 'price_change_percentage_24h' => 1.0],
                ]),
                default => Http::response([], 404),
            };
        });
    }

    private function subscriber(array $columns = []): PushSubscription
    {
        $endpoint = 'https://fcm.googleapis.com/fcm/send/' . ++$this->endpoints;

        return PushSubscription::create([
            'endpoint' => $endpoint,
            'endpoint_hash' => PushSubscription::hashEndpoint($endpoint),
            'public_key' => 'key',
            'auth_token' => 'auth',
            'timezone' => 'Asia/Manila',
            'categories' => ['price' => true, 'market' => false, 'brief' => false],
            'quiet_start' => '23:00',
            'quiet_end' => '07:00',
            'brief_time' => '08:00',
            'currency' => 'php',
            ...$columns,
        ]);
    }

    private function alert(PushSubscription $subscription, string $coin, string $direction, float $threshold, string $currency = 'usd'): PriceAlert
    {
        return $subscription->alerts()->create([
            'coin_id' => $coin,
            'coin_symbol' => ['bitcoin' => 'btc', 'ethereum' => 'eth', 'solana' => 'sol'][$coin] ?? $coin,
            'direction' => $direction,
            'threshold' => $threshold,
            'currency' => $currency,
        ]);
    }

    private function check(): array
    {
        return app(PushCheck::class)->run();
    }

    // ---- Price alerts ----

    public function test_a_price_alert_fires_once_with_a_deep_link(): void
    {
        $subscription = $this->subscriber();
        $alert = $this->alert($subscription, 'bitcoin', 'above', 65_000);

        $this->assertSame(1, $this->check()['price']);

        $this->assertSame([[
            'subscription' => $subscription->id,
            'payload' => ['title' => 'BTC is above $65,000', 'body' => 'Now $70,000.', 'url' => '/coin/bitcoin', 'tag' => 'price:bitcoin'],
        ]], $this->sender->sent);
        $this->assertNotNull($alert->fresh()->triggered_at);
        $this->assertSame('BTC is above $65,000', PushNotification::first()->title);

        // A fired alert doesn't fire again.
        $this->travel(3)->hours();
        $this->check();
        $this->assertCount(1, $this->sender->sent);
    }

    public function test_an_alert_the_price_has_not_reached_waits(): void
    {
        $alert = $this->alert($this->subscriber(), 'bitcoin', 'below', 60_000);

        $this->check();

        $this->assertSame([], $this->sender->sent);
        $this->assertNull($alert->fresh()->triggered_at);
    }

    public function test_alerts_compare_in_the_currency_they_were_set_in(): void
    {
        $subscription = $this->subscriber();
        // 70,000 USD at 58 PHP per USD is ₱4,060,000.
        $this->alert($subscription, 'bitcoin', 'above', 4_000_000, 'php');
        $this->alert($subscription, 'bitcoin', 'above', 4_100_000, 'php');

        $this->check();

        $this->assertSame(['BTC is above ₱4,000,000'], $this->sender->titles());
        $this->assertSame('Now ₱4,060,000.', $this->sender->sent[0]['payload']['body']);
    }

    public function test_several_hits_at_once_become_one_notification(): void
    {
        $subscription = $this->subscriber();
        $this->alert($subscription, 'bitcoin', 'above', 65_000);
        $this->alert($subscription, 'ethereum', 'below', 3_000);

        $this->check();

        $this->assertSame(['2 of your price alerts were hit'], $this->sender->titles());
        $this->assertSame('BTC above $65,000 · ETH below $3,000', $this->sender->sent[0]['payload']['body']);
        $this->assertSame('/alerts', $this->sender->sent[0]['payload']['url']);
        $this->assertSame(0, PriceAlert::whereNull('triggered_at')->count());
    }

    public function test_quiet_hours_hold_price_alerts_unless_the_user_lets_them_through(): void
    {
        // 16:00 UTC is midnight in Manila.
        $this->travelTo('2026-11-08 16:00:00');

        $held = $this->alert($this->subscriber(), 'bitcoin', 'above', 65_000);
        $this->alert($this->subscriber(['price_alerts_in_quiet' => true]), 'bitcoin', 'above', 65_000);

        $this->check();

        $this->assertCount(1, $this->sender->sent);
        $this->assertNull($held->fresh()->triggered_at);

        // Morning comes and the held one goes out.
        $this->travelTo('2026-11-08 23:30:00');
        $this->check();
        $this->assertNotNull($held->fresh()->triggered_at);
    }

    public function test_the_daily_cap_holds_further_alerts(): void
    {
        config(['push.daily_cap' => 2]);
        $subscription = $this->subscriber();

        foreach (['bitcoin', 'ethereum', 'solana'] as $i => $coin) {
            $this->alert($subscription, $coin, 'above', 1);
            $this->check();
            $this->travel(1)->minutes();
        }

        $this->assertCount(2, $this->sender->sent);
        $this->assertSame(1, PriceAlert::whereNull('triggered_at')->count());
    }

    public function test_a_coin_alerted_recently_waits_out_its_cooldown(): void
    {
        $subscription = $this->subscriber();
        $this->alert($subscription, 'bitcoin', 'above', 65_000);
        $this->check();

        $second = $this->alert($subscription, 'bitcoin', 'above', 66_000);
        $this->travel(30)->minutes();
        $this->check();
        $this->assertNull($second->fresh()->triggered_at);

        $this->travel(2)->hours();
        $this->check();
        $this->assertNotNull($second->fresh()->triggered_at);
    }

    public function test_an_old_price_never_fires_an_alert(): void
    {
        $subscription = $this->subscriber(['categories' => ['price' => false]]);
        $alert = $this->alert($subscription, 'bitcoin', 'below', 80_000);

        // The price gets cached while alerts are off, then CoinGecko goes down.
        $this->check();
        $this->upstreamUp = false;
        $this->travel(20)->minutes();
        $subscription->update(['categories' => ['price' => true]]);

        $this->check();

        $this->assertSame([], $this->sender->sent);
        $this->assertNull($alert->fresh()->triggered_at);
    }

    public function test_turned_off_price_alerts_stay_quiet(): void
    {
        $this->alert($this->subscriber(['categories' => ['price' => false]]), 'bitcoin', 'above', 1);

        $this->check();

        $this->assertSame([], $this->sender->sent);
    }

    public function test_an_expired_subscription_is_removed_with_its_alerts(): void
    {
        $this->alert($this->subscriber(), 'bitcoin', 'above', 1);
        $this->sender->result = PushSender::EXPIRED;

        $this->check();

        $this->assertSame(0, PushSubscription::count());
        $this->assertDatabaseCount('price_alerts', 0);
    }

    public function test_a_failed_send_is_tried_again_next_run(): void
    {
        $alert = $this->alert($this->subscriber(), 'bitcoin', 'above', 1);
        $this->sender->result = PushSender::FAILED;

        $this->check();
        $this->assertNull($alert->fresh()->triggered_at);

        $this->sender->result = PushSender::SENT;
        $this->travel(10)->minutes();
        $this->check();
        $this->assertNotNull($alert->fresh()->triggered_at);
    }

    // ---- Market drop or rally ----

    public function test_a_market_drop_reaches_only_those_who_asked_once_per_direction(): void
    {
        $this->market24h = -6.1;
        $wants = $this->subscriber(['categories' => ['market' => true]]);
        $this->subscriber();

        $this->assertSame(1, $this->check()['market']);

        $this->assertSame([[
            'subscription' => $wants->id,
            'payload' => ['title' => 'Crypto market down 6.1% in 24h', 'body' => 'BTC -5.8%, ETH -7.2%.', 'url' => '/', 'tag' => 'market'],
        ]], $this->sender->sent);

        // The drop lasting all afternoon doesn't mean another alert.
        $this->travel(1)->hours();
        $this->check();
        $this->assertCount(1, $this->sender->sent);
    }

    public function test_a_calm_market_sends_nothing(): void
    {
        $this->subscriber(['categories' => ['market' => true]]);

        $this->check();

        $this->assertSame([], $this->sender->sent);
    }

    public function test_btc_moving_seven_percent_in_four_hours_is_a_market_alert(): void
    {
        $this->subscriber(['categories' => ['market' => true]]);

        $this->check();
        $this->travel(4)->hours();
        $this->prices['bitcoin'] = 64_500; // -7.9%
        $this->check();

        $this->assertSame(['BTC down 7.9% in 4 hours'], $this->sender->titles());
        $this->assertSame('Crypto market +1.2% in 24h, ETH -7.2%.', $this->sender->sent[0]['payload']['body']);
    }

    // ---- Daily brief ----

    public function test_the_brief_comes_once_a_day_at_the_chosen_time(): void
    {
        NewsSentimentSnapshot::create(['bullish' => 58, 'bearish' => 20, 'neutral' => 22, 'label' => 'bullish', 'by_asset' => [], 'story_count' => 9]);
        $subscription = $this->subscriber(['categories' => ['brief' => true], 'brief_time' => '13:00']);

        // Noon in Manila: not yet.
        $this->check();
        $this->assertSame([], $this->sender->sent);

        $this->travel(65)->minutes();
        $this->assertSame(1, $this->check()['brief']);

        $this->assertSame('Your daily crypto brief', $this->sender->sent[0]['payload']['title']);
        $this->assertSame('Market +1.2% in 24h · sentiment 58% bullish · no big stories today.', $this->sender->sent[0]['payload']['body']);
        $this->assertSame('/news', $this->sender->sent[0]['payload']['url']);

        $this->travel(20)->minutes();
        $this->check();
        $this->assertCount(1, $this->sender->sent);
        $this->assertSame('2026-11-08', $subscription->fresh()->last_brief_on->toDateString());
    }

    public function test_a_brief_hours_late_is_skipped_for_the_day(): void
    {
        // The server slept from 8 AM to noon Manila time.
        $this->subscriber(['categories' => ['brief' => true], 'brief_time' => '08:00']);

        $this->check();

        $this->assertSame([], $this->sender->sent);
    }

    public function test_the_brief_ignores_quiet_hours_since_the_user_picked_the_time(): void
    {
        $this->travelTo('2026-11-08 15:10:00'); // 23:10 in Manila
        $this->subscriber(['categories' => ['brief' => true], 'brief_time' => '23:00']);

        $this->check();

        $this->assertCount(1, $this->sender->sent);
    }

    // ---- Housekeeping ----

    public function test_nothing_runs_without_vapid_keys(): void
    {
        $this->sender->configured = false;
        $this->alert($this->subscriber(), 'bitcoin', 'above', 1);

        $this->assertFalse($this->check()['ran']);
        $this->assertSame([], $this->sender->sent);
        Http::assertNothingSent();
    }

    public function test_old_history_and_fired_alerts_are_cleared(): void
    {
        $subscription = $this->subscriber();
        $this->alert($subscription, 'bitcoin', 'above', 1);
        $this->check();

        $this->travel(31)->days();
        $this->check();

        $this->assertDatabaseCount('push_notifications', 0);
        $this->assertDatabaseCount('price_alerts', 0);
    }

    // ---- Big moves and level breaks on watched coins ----

    private function watcher(array $coins, array $columns = []): PushSubscription
    {
        return $this->subscriber(['categories' => ['moves' => true], 'watch_coins' => $coins, ...$columns]);
    }

    public function test_a_watched_coin_moving_eight_percent_in_four_hours_is_sent_once(): void
    {
        // Symbols come from the market list a page load would have cached.
        MarketData::remember('coins');
        $watcher = $this->watcher(['solana']);
        $this->watcher(['ethereum']);
        $this->subscriber(['watch_coins' => ['solana']]); // category off

        $this->check();
        $this->travel(4)->hours();
        $this->prices['solana'] = 136; // -9.3%

        $this->assertSame(1, $this->check()['moves']);
        $this->assertSame([[
            'subscription' => $watcher->id,
            // In the subscriber's currency: 136 USD at 58 PHP per USD.
            'payload' => ['title' => 'SOL down 9.3% in 4 hours', 'body' => 'Now ₱7,888.', 'url' => '/coin/solana', 'tag' => 'moves:solana'],
        ]], $this->sender->sent);

        // The drop lasting longer doesn't mean another alert.
        $this->travel(10)->minutes();
        $this->check();
        $this->assertCount(1, $this->sender->sent);
    }

    public function test_several_watched_coins_moving_become_one_notification(): void
    {
        MarketData::remember('coins');
        $this->watcher(['solana', 'ethereum']);

        $this->check();
        $this->travel(4)->hours();
        $this->prices['solana'] = 136;
        $this->prices['ethereum'] = 2_250;
        $this->check();

        $this->assertSame(['2 of your coins are down 8%+ in 4 hours'], $this->sender->titles());
        $this->assertSame('SOL -9.3% · ETH -10.0%', $this->sender->sent[0]['payload']['body']);
        $this->assertSame('/alerts', $this->sender->sent[0]['payload']['url']);
    }

    public function test_small_moves_send_nothing(): void
    {
        $this->watcher(['solana']);

        $this->check();
        $this->travel(4)->hours();
        $this->prices['solana'] = 140; // -6.7%
        $this->check();

        $this->assertSame([], $this->sender->sent);
    }

    /**
     * A month of 4-hour candles that rose to about 160 and fell back six
     * times: a well-tested resistance zone.
     */
    private function cacheRangeCandles(string $coin): void
    {
        $closes = [];

        for ($cycle = 0; $cycle < 6; $cycle++) {
            array_push($closes, 140, 145, 150, 155, 160, 155, 150, 145);
        }

        $closes[] = 150;
        $candles = [];
        $open = 140;
        $start = now()->getTimestamp() - count($closes) * 14_400;

        foreach ($closes as $i => $close) {
            $candles[] = [
                'time' => $start + $i * 14_400,
                'open' => $open,
                'high' => max($open, $close) + 0.5,
                'low' => min($open, $close) - 0.5,
                'close' => $close,
            ];
            $open = $close;
        }

        StaleCache::put(ChartData::chartKey($coin, '30d'), ['candles' => $candles, 'volume' => [], 'price' => 150]);
    }

    public function test_a_break_above_tested_resistance_is_sent_with_the_zone(): void
    {
        MarketData::remember('coins');
        $this->cacheRangeCandles('solana');
        $this->watcher(['solana'], ['currency' => 'usd']);

        // The first look only records the price.
        $this->check();
        $this->assertSame([], $this->sender->sent);

        $this->travel(10)->minutes();
        $this->prices['solana'] = 165;
        $this->check();

        $this->assertSame(['SOL broke above resistance'], $this->sender->titles());
        $this->assertMatchesRegularExpression(
            '/^Now \$165\.00, above the 7D resistance zone at \$\d+\.\d\d–\$\d+\.\d\d\.$/u',
            $this->sender->sent[0]['payload']['body'],
        );

        // Falling back through it is news too, once the coin's cooldown is over.
        $this->travel(3)->hours();
        $this->check();
        $this->travel(10)->minutes();
        $this->prices['solana'] = 150;
        $this->check();
        $this->assertSame(['SOL broke above resistance', 'SOL broke below support'], $this->sender->titles());

        // Breaking up through the same level again that day is not.
        $this->cacheRangeCandles('solana');
        $this->travel(3)->hours();
        $this->check();
        $this->travel(10)->minutes();
        $this->prices['solana'] = 165;
        $this->check();
        $this->assertCount(2, $this->sender->sent);
    }

    public function test_price_moving_inside_a_zone_is_not_a_break(): void
    {
        $this->cacheRangeCandles('solana');
        $this->watcher(['solana']);

        $this->check();
        $this->travel(10)->minutes();
        $this->prices['solana'] = 159;
        $this->check();

        $this->assertSame([], $this->sender->sent);
    }

    public function test_a_level_crossed_while_the_server_slept_is_old_news(): void
    {
        $this->cacheRangeCandles('solana');
        $this->watcher(['solana']);

        $this->check();
        $this->travel(2)->hours();
        $this->cacheRangeCandles('solana');
        $this->prices['solana'] = 165;
        $this->check();

        $this->assertSame([], $this->sender->sent);
    }

    // ---- Breaking news and mood shifts ----

    private function story(string $title, array $columns = []): NewsCluster
    {
        $cluster = NewsCluster::create([
            'batch_id' => NewsBatch::create(['status' => 'published', 'started_at' => now()])->id,
            'assets' => ['BTC'],
            'tags' => [],
            'trader_relevance' => 80,
            'analysis_status' => NewsCluster::STATUS_ANALYZED,
            'analyzed_at' => now(),
            'first_published_at' => now()->subHour(),
            'latest_published_at' => now()->subHour(),
            'label' => 'bearish',
            'impact' => 'high',
            'summary' => 'The decision moves to next quarter.',
            ...$columns,
        ]);

        $article = NewsArticle::create([
            'cluster_id' => $cluster->id,
            'source' => 'test',
            'source_name' => 'Test News',
            'url' => 'https://news.test/' . md5($title),
            'url_hash' => hash('sha256', $title),
            'title' => $title,
            'title_tokens' => [],
            'credibility' => 0.9,
            'published_at' => now()->subHour(),
        ]);

        $cluster->update(['primary_article_id' => $article->id]);

        return $cluster;
    }

    public function test_a_high_impact_story_is_sent_once_with_a_deep_link(): void
    {
        $story = $this->story('SEC delays decision on spot ETF');
        $this->story('Minor exchange update', ['impact' => 'low']);
        $wants = $this->subscriber(['categories' => ['news' => true]]);
        $this->subscriber();

        $this->assertSame(1, $this->check()['news']);
        $this->assertSame([[
            'subscription' => $wants->id,
            'payload' => [
                'title' => 'Bearish, high impact: SEC delays decision on spot ETF',
                'body' => 'The decision moves to next quarter.',
                'url' => '/news#story-' . $story->id,
                'tag' => 'news',
            ],
        ]], $this->sender->sent);

        $this->travel(10)->minutes();
        $this->check();
        $this->assertCount(1, $this->sender->sent);
    }

    public function test_old_and_sample_stories_are_not_breaking_news(): void
    {
        $this->story('Yesterday story', ['latest_published_at' => now()->subHours(20)]);
        $this->story('Sample story', ['summary' => '[Demo] Sample summary.']);
        $this->subscriber(['categories' => ['news' => true]]);

        $this->check();

        $this->assertSame([], $this->sender->sent);
    }

    public function test_news_alerts_stop_at_two_a_day(): void
    {
        $this->subscriber(['categories' => ['news' => true]]);

        foreach (['First story', 'Second story', 'Third story'] as $title) {
            $this->story($title);
            $this->check();
            $this->travel(10)->minutes();
        }

        $this->assertCount(2, $this->sender->sent);
    }

    public function test_a_mood_shift_is_sent_when_the_label_changes(): void
    {
        $this->subscriber(['categories' => ['news' => true]]);
        NewsSentimentSnapshot::create(['bullish' => 30, 'bearish' => 25, 'neutral' => 45, 'label' => 'neutral', 'by_asset' => [], 'story_count' => 9]);

        // The first look only records the mood.
        $this->check();
        $this->assertSame([], $this->sender->sent);

        NewsSentimentSnapshot::create(['bullish' => 61, 'bearish' => 14, 'neutral' => 25, 'label' => 'bullish', 'by_asset' => [], 'story_count' => 9]);
        $this->travel(10)->minutes();
        $this->check();

        $this->assertSame(['Market sentiment shifted from Neutral to Bullish (61% bullish)'], $this->sender->titles());
        $this->assertSame('/news', $this->sender->sent[0]['payload']['url']);

        // Flipping straight back waits out the cooldown.
        NewsSentimentSnapshot::create(['bullish' => 30, 'bearish' => 25, 'neutral' => 45, 'label' => 'neutral', 'by_asset' => [], 'story_count' => 9]);
        $this->travel(10)->minutes();
        $this->check();
        $this->assertCount(1, $this->sender->sent);
    }
}
