<?php

namespace Tests\Feature\Wallet;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class PricesApiTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Cache::flush();
        Http::preventStrayRequests();
    }

    private function fakePrices(): void
    {
        Http::fake([
            'api.coingecko.com/api/v3/simple/price*' => Http::response([
                'bitcoin' => ['usd' => 81000.5, 'php' => 4700000, 'usd_24h_change' => 1.25, 'php_24h_change' => 1.1, 'last_updated_at' => 1_761_700_000],
                'ethereum' => ['usd' => 2300, 'php' => 133000, 'usd_24h_change' => -0.8, 'php_24h_change' => -0.9, 'last_updated_at' => 1_761_700_000],
            ]),
        ]);
    }

    public function test_returns_usd_and_php_prices_in_one_upstream_call(): void
    {
        $this->fakePrices();

        $this->getJson('/api/prices?ids=ethereum,bitcoin')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.bitcoin.usd', 81000.5)
            ->assertJsonPath('data.bitcoin.php', 4700000)
            ->assertJsonPath('data.ethereum.usd_24h_change', -0.8);

        Http::assertSentCount(1);
        Http::assertSent(fn ($request) => $request['ids'] === 'bitcoin,ethereum'
            && $request['vs_currencies'] === 'usd,php'
            && $request['include_24hr_change'] === 'true');
    }

    public function test_same_coins_in_any_order_share_the_cache(): void
    {
        $this->fakePrices();

        $this->getJson('/api/prices?ids=bitcoin,ethereum')->assertOk();
        $this->getJson('/api/prices?ids=ethereum,bitcoin,bitcoin')->assertOk();

        Http::assertSentCount(1);
    }

    public function test_serves_last_good_prices_when_coingecko_fails(): void
    {
        Http::fake([
            'api.coingecko.com/api/v3/simple/price*' => Http::sequence()
                ->push(['bitcoin' => ['usd' => 81000.5, 'php' => 4700000]])
                ->push('error', 500),
        ]);
        $this->getJson('/api/prices?ids=bitcoin')->assertOk();

        $this->travel(2)->minutes();

        $this->getJson('/api/prices?ids=bitcoin')
            ->assertOk()
            ->assertJsonPath('stale', true)
            ->assertJsonPath('data.bitcoin.usd', 81000.5);
    }

    public function test_caches_per_coin_so_overlapping_portfolios_share_prices(): void
    {
        Http::fake([
            'api.coingecko.com/api/v3/simple/price*' => fn ($request) => Http::response(
                collect(explode(',', $request['ids']))
                    ->mapWithKeys(fn ($id) => [$id => ['usd' => 1, 'php' => 58, 'usd_24h_change' => 0, 'php_24h_change' => 0]])
                    ->all()
            ),
        ]);

        $this->getJson('/api/prices?ids=bitcoin,ethereum')->assertOk();
        $this->getJson('/api/prices?ids=bitcoin,solana')->assertOk()->assertJsonPath('data.solana.php', 58);
        $this->getJson('/api/prices?ids=ethereum,solana')->assertOk();

        // Second portfolio only needed solana; the third needed nothing.
        Http::assertSentCount(2);
        Http::assertSent(fn ($request) => $request['ids'] === 'solana');

        // After a minute, all three are stale and refresh in one call.
        $this->travel(61)->seconds();
        $this->getJson('/api/prices?ids=bitcoin,ethereum,solana')->assertOk()->assertJsonPath('stale', false);
        Http::assertSentCount(3);
    }

    public function test_unknown_coins_are_left_out_and_not_asked_about_again(): void
    {
        Http::fake([
            'api.coingecko.com/api/v3/simple/price*' => Http::sequence()
                ->push(['bitcoin' => ['usd' => 1, 'php' => 58]])
                ->push([], 200),
        ]);

        $this->getJson('/api/prices?ids=bitcoin,no-such-coin')
            ->assertOk()
            ->assertJsonPath('stale', false)
            ->assertJsonMissingPath('data.no-such-coin');

        $this->travel(2)->minutes();

        // Only bitcoin is refreshed; the unknown coin is remembered for an hour.
        $this->getJson('/api/prices?ids=bitcoin,no-such-coin')->assertOk();
        Http::assertSent(fn ($request) => $request['ids'] === 'bitcoin');
        Http::assertSentCount(2);
    }

    public function test_an_empty_reply_is_rechecked_after_five_minutes_not_an_hour(): void
    {
        Http::fake([
            'api.coingecko.com/api/v3/simple/price*' => Http::sequence()
                ->push([], 200) // glitch: no prices at all
                ->push(['bitcoin' => ['usd' => 81000, 'php' => 4700000]]),
        ]);

        $this->getJson('/api/prices?ids=bitcoin')->assertOk()->assertJsonMissingPath('data.bitcoin');

        $this->travel(4)->minutes();
        $this->getJson('/api/prices?ids=bitcoin')->assertOk();
        Http::assertSentCount(1);

        $this->travel(2)->minutes();
        $this->getJson('/api/prices?ids=bitcoin')->assertOk()->assertJsonPath('data.bitcoin.usd', 81000);
        Http::assertSentCount(2);
    }

    public function test_unavailable_when_nothing_is_cached_and_coingecko_fails(): void
    {
        Http::fake(['api.coingecko.com/*' => Http::response('error', 500)]);

        $this->getJson('/api/prices?ids=bitcoin')->assertStatus(503);
    }

    public function test_rejects_bad_ids(): void
    {
        $this->getJson('/api/prices')->assertStatus(422);
        $this->getJson('/api/prices?ids=bit%20coin')->assertStatus(422);
        $this->getJson('/api/prices?ids=' . implode(',', array_map(fn ($i) => "coin-{$i}", range(1, 251))))->assertStatus(422);

        Http::assertNothingSent();
    }

    public function test_coin_list_comes_from_the_cached_index_by_rank(): void
    {
        $page = fn (int $start) => array_map(fn ($rank) => [
            'id' => "coin-{$rank}", 'name' => "Coin {$rank}", 'symbol' => "c{$rank}",
            'image' => null, 'market_cap_rank' => $rank,
        ], range($start, $start + 249));

        Http::fake([
            'api.coingecko.com/api/v3/coins/markets*' => Http::sequence()
                ->push(array_reverse($page(1)))
                ->push($page(251))
                ->push($page(501))
                ->push($page(751)),
        ]);

        $response = $this->getJson('/api/coin-list')->assertOk();

        $this->assertCount(100, $response->json('data'));
        $this->assertSame('coin-1', $response->json('data.0.id'));
        $this->assertSame(100, $response->json('data.99.market_cap_rank'));
    }
}
