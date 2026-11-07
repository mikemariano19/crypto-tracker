<?php

namespace Tests\Feature\Insight;

use App\Services\Insight\ChartData;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class InsightChartTest extends TestCase
{
    // Thirty minutes apart, in milliseconds as CoinGecko sends them.
    private const T0 = 1_762_000_000_000;

    private const STEP = 1_800_000;

    protected function setUp(): void
    {
        parent::setUp();

        Cache::flush();
        Http::preventStrayRequests();
    }

    private function fakeCoinGecko(string $coin = 'bitcoin'): void
    {
        Http::fake([
            "api.coingecko.com/api/v3/coins/{$coin}/ohlc*" => Http::response([
                [self::T0, 100, 110, 90, 105],
                [self::T0 + self::STEP, 105, 115, 100, 112],
            ]),
            "api.coingecko.com/api/v3/coins/{$coin}/market_chart*" => Http::response([
                'prices' => [[self::T0, 105]],
                'total_volumes' => [[self::T0, 1000], [self::T0 + self::STEP, 1200]],
            ]),
        ]);
    }

    public function test_returns_candles_and_volume_in_seconds(): void
    {
        $this->fakeCoinGecko();

        $time = (int) (self::T0 / 1000);

        $this->getJson('/api/coins/bitcoin/chart?tf=1d')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.coinId', 'bitcoin')
            ->assertJsonPath('data.timeframe', '1d')
            ->assertJsonPath('data.candles.0.time', $time)
            ->assertJsonPath('data.candles.0.high', 110)
            ->assertJsonPath('data.candles.1.close', 112)
            ->assertJsonPath('data.volume.0', ['time' => $time, 'value' => 1000])
            ->assertJsonPath('data.volume.1.value', 1200);
    }

    public function test_each_timeframe_asks_for_its_own_range(): void
    {
        $this->fakeCoinGecko();

        $this->getJson('/api/coins/bitcoin/chart?tf=1d')->assertOk();

        Http::assertSentCount(2);
        Http::assertSent(fn (Request $request) => str_contains($request->url(), '/ohlc') && $request['days'] === 1);
        Http::assertSent(fn (Request $request) => str_contains($request->url(), '/market_chart') && $request['days'] === 1);
    }

    public function test_seven_day_chart_fetches_the_analysis_history_in_the_same_two_calls(): void
    {
        $this->fakeCoinGecko();

        $this->getJson('/api/coins/bitcoin/chart?tf=7d')->assertOk();

        // Same 4-hour candles as 7 days, with the extra history the analysis needs.
        Http::assertSentCount(2);
        Http::assertSent(fn (Request $request) => str_contains($request->url(), '/ohlc') && $request['days'] === 30);
        Http::assertSent(fn (Request $request) => str_contains($request->url(), '/market_chart') && $request['days'] === 30);
        $this->assertNotNull(Cache::get('swr:' . ChartData::historyKey('bitcoin', '7d')));
    }

    public function test_second_request_is_served_from_cache(): void
    {
        $this->fakeCoinGecko();

        $this->getJson('/api/coins/bitcoin/chart?tf=1d')->assertOk()->assertJsonPath('source', 'upstream');
        $this->getJson('/api/coins/bitcoin/chart?tf=1d')->assertOk()->assertJsonPath('source', 'cache');

        Http::assertSentCount(2);
    }

    public function test_timeframes_are_cached_separately(): void
    {
        $this->fakeCoinGecko();

        $this->getJson('/api/coins/bitcoin/chart?tf=1d')->assertOk();
        $this->getJson('/api/coins/bitcoin/chart?tf=7d')->assertOk()->assertJsonPath('data.timeframe', '7d');

        Http::assertSentCount(4);
    }

    public function test_says_whether_analysis_is_allowed(): void
    {
        config(['insight.allowed_coins' => ['bitcoin' => 'BTC']]);
        $this->fakeCoinGecko('bitcoin');
        $this->getJson('/api/coins/bitcoin/chart')->assertOk()->assertJsonPath('data.analysisAllowed', true);

        // Other coins still get the plain chart.
        $this->fakeCoinGecko('pepe');
        $this->getJson('/api/coins/pepe/chart')->assertOk()->assertJsonPath('data.analysisAllowed', false);
    }

    public function test_rejects_bad_input_without_calling_upstream(): void
    {
        Http::fake();

        $this->getJson('/api/coins/bitcoin/chart?tf=2d')->assertStatus(422);
        $this->getJson('/api/coins/bad%20id/chart')->assertStatus(422);
        // Long ranges are chart only: there is nothing to analyze.
        $this->getJson('/api/insight/bitcoin?tf=30d')->assertStatus(422);
        $this->postJson('/api/insight/bitcoin?tf=1y')->assertStatus(422);

        Http::assertNothingSent();
    }

    public function test_thirty_days_and_a_year_use_coingecko_candles(): void
    {
        config(['insight.allowed_coins' => ['bitcoin' => 'BTC']]);
        $this->fakeCoinGecko();

        $this->getJson('/api/coins/bitcoin/chart?tf=30d')
            ->assertOk()
            ->assertJsonPath('data.timeframe', '30d')
            ->assertJsonPath('data.analysisAllowed', false)
            ->assertJsonCount(2, 'data.candles');
        $this->getJson('/api/coins/bitcoin/chart?tf=1y')->assertOk()->assertJsonPath('data.timeframe', '1y');

        Http::assertSentCount(4);
        Http::assertSent(fn (Request $request) => str_contains($request->url(), '/ohlc') && $request['days'] === 30);
        Http::assertSent(fn (Request $request) => str_contains($request->url(), '/ohlc') && $request['days'] === 365);
    }

    public function test_ninety_days_builds_daily_candles_from_hourly_prices(): void
    {
        $day = 86_400;
        $start = 1_762_041_600; // A UTC midnight.

        Http::fake([
            'api.coingecko.com/api/v3/coins/bitcoin/market_chart*' => Http::response([
                'prices' => [
                    [$start * 1000, 100],
                    [($start + 3_600) * 1000, 120],
                    [($start + 7_200) * 1000, 90],
                    [($start + 10_800) * 1000, 110],
                    [($start + $day) * 1000, 111],
                    [($start + $day + 3_600) * 1000, 105],
                ],
                'total_volumes' => [[$start * 1000, 1000], [($start + $day + 3_600) * 1000, 1500]],
            ]),
        ]);

        $this->getJson('/api/coins/bitcoin/chart?tf=90d')
            ->assertOk()
            ->assertJsonPath('data.analysisAllowed', false)
            ->assertJsonPath('data.candles', [
                ['time' => $start + $day, 'open' => 100, 'high' => 120, 'low' => 90, 'close' => 110],
                ['time' => $start + 2 * $day, 'open' => 111, 'high' => 111, 'low' => 105, 'close' => 105],
            ])
            ->assertJsonPath('data.volume.1.value', 1500)
            ->assertJsonPath('data.price', 105);

        // One call: the OHLC endpoint's 90-day candles are too coarse to use.
        Http::assertSentCount(1);
        Http::assertSent(fn (Request $request) => $request['days'] === 90);
    }

    public function test_long_ranges_stay_fresh_longer(): void
    {
        $this->fakeCoinGecko();

        $this->getJson('/api/coins/bitcoin/chart?tf=1y')->assertOk();
        $this->travel((int) config('insight.chart_fresh_seconds') + 1)->seconds();
        $this->getJson('/api/coins/bitcoin/chart?tf=1y')->assertOk()->assertJsonPath('source', 'cache');

        Http::assertSentCount(2);
    }

    public function test_unknown_coin_is_a_404(): void
    {
        Http::fake(['api.coingecko.com/*' => Http::response(['error' => 'coin not found'], 404)]);

        $this->getJson('/api/coins/not-a-coin/chart')->assertNotFound();
    }

    public function test_rate_limit_with_nothing_cached_is_a_503(): void
    {
        Http::fake(['api.coingecko.com/*' => Http::response([], 429)]);

        $this->getJson('/api/coins/bitcoin/chart')->assertStatus(503)->assertJsonPath('success', false);
    }

    public function test_failed_refresh_keeps_serving_the_last_chart(): void
    {
        $up = true;

        Http::fake(function (Request $request) use (&$up) {
            return match (true) {
                !$up => Http::response([], 500),
                str_contains($request->url(), '/ohlc') => Http::response([[self::T0, 100, 110, 90, 105], [self::T0 + self::STEP, 105, 115, 100, 112]]),
                default => Http::response(['total_volumes' => [[self::T0, 1000]]]),
            };
        });

        $this->getJson('/api/coins/bitcoin/chart')->assertOk();

        $this->travel((int) config('insight.chart_fresh_seconds') + 1)->seconds();

        $up = false;

        $this->getJson('/api/coins/bitcoin/chart')
            ->assertOk()
            ->assertJsonPath('stale', true)
            ->assertJsonPath('data.candles.0.close', 105);
    }

    public function test_candles_skip_bad_rows_and_end_up_ordered_and_unique(): void
    {
        $candles = ChartData::candles([
            [3000, 3, 3, 3, 3],
            'not a row',
            [1000, 1, 1, 1, null],
            [2000, 2, 2, 2, 2],
            [3000, 9, 9, 9, 9],
            [4000, 4, 4],
        ]);

        $this->assertSame([2, 3], array_column($candles, 'time'));
        $this->assertSame(9.0, $candles[1]['close']);
    }

    public function test_too_few_candles_are_rejected(): void
    {
        $this->expectException(\UnexpectedValueException::class);

        ChartData::candles([[1000, 1, 1, 1, 1]]);
    }

    public function test_each_candle_takes_the_latest_volume_at_its_close(): void
    {
        $candles = [['time' => 5], ['time' => 10], ['time' => 15], ['time' => 20]];

        $volume = ChartData::volumeAtCandles($candles, [
            [9000, 90],
            [10000, 100],
            [17000, 170],
            ['bad', 1],
        ]);

        // Nothing is known at 5s, and nothing new arrives between 10s and 15s.
        $this->assertSame([
            ['time' => 10, 'value' => 100.0],
            ['time' => 15, 'value' => 100.0],
            ['time' => 20, 'value' => 170.0],
        ], $volume);
    }

    public function test_no_volume_data_still_gives_a_chart(): void
    {
        Http::fake([
            'api.coingecko.com/api/v3/coins/bitcoin/ohlc*' => Http::response([
                [self::T0, 1, 1, 1, 1],
                [self::T0 + self::STEP, 2, 2, 2, 2],
            ]),
            'api.coingecko.com/api/v3/coins/bitcoin/market_chart*' => Http::response(['prices' => [[self::T0, 1]]]),
        ]);

        $this->getJson('/api/coins/bitcoin/chart')
            ->assertOk()
            ->assertJsonCount(2, 'data.candles')
            ->assertJsonCount(0, 'data.volume');
    }
}
