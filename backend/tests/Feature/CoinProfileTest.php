<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class CoinProfileTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Cache::flush();
        Http::preventStrayRequests();
    }

    public function test_profile_has_clean_links_contracts_and_categories(): void
    {
        Http::fake([
            'api.coingecko.com/api/v3/coins/chainlink*' => Http::response([
                'id' => 'chainlink',
                'name' => 'Chainlink',
                'symbol' => 'link',
                'asset_platform_id' => 'ethereum',
                'categories' => ['Solana Ecosystem', 'Oracle', 'GMCI 30 Index', 'Decentralized Finance (DeFi)', 'Oracle', 'Base Native'],
                'platforms' => ['monad' => '0xmonad', 'ethereum' => '0xeth', '' => '', 'polygon-pos' => ' '],
                'links' => [
                    'homepage' => ['', 'https://chain.link/'],
                    'whitepaper' => 'javascript:alert(1)',
                    'blockchain_site' => ['https://etherscan.io/token/0xeth', '', 'ftp://bad', 'https://a.io', 'https://b.io', 'https://c.io'],
                    'repos_url' => ['github' => ['https://github.com/smartcontractkit/chainlink']],
                    'twitter_screen_name' => 'chainlink',
                    'subreddit_url' => 'https://www.reddit.com/r/Chainlink/',
                    'telegram_channel_identifier' => 'bad handle!',
                ],
                'market_data' => ['current_price' => ['usd' => 11.7]],
            ]),
        ]);

        $this->getJson('/api/coin/chainlink')
            ->assertOk()
            ->assertJsonPath('data.categories', ['Oracle', 'Decentralized Finance (DeFi)'])
            ->assertJsonPath('data.contracts', [
                ['platform' => 'ethereum', 'address' => '0xeth'],
                ['platform' => 'monad', 'address' => '0xmonad'],
            ])
            ->assertJsonPath('data.links.homepage', 'https://chain.link/')
            ->assertJsonPath('data.links.whitepaper', null)
            ->assertJsonPath('data.links.explorers', ['https://etherscan.io/token/0xeth', 'https://a.io', 'https://b.io', 'https://c.io'])
            ->assertJsonPath('data.links.twitter', 'https://x.com/chainlink')
            ->assertJsonPath('data.links.telegram', null);
    }

    public function test_markets_skip_flagged_tickers_and_unsafe_links(): void
    {
        $ticker = fn (array $extra) => array_merge([
            'base' => 'LINK',
            'target' => 'USDT',
            'coin_id' => 'chainlink',
            'market' => ['name' => 'Binance', 'logo' => 'https://img/binance.jpg'],
            'converted_last' => ['usd' => 11.68],
            'converted_volume' => ['usd' => 24247733],
            'bid_ask_spread_percentage' => 0.0185,
            'trade_url' => 'https://www.binance.com/en/trade/LINK_USDT',
            'last_traded_at' => '2026-10-31T17:28:54+00:00',
            'is_anomaly' => false,
            'is_stale' => false,
        ], $extra);

        Http::fake([
            'api.coingecko.com/api/v3/coins/chainlink/tickers*' => Http::response(['tickers' => [
                $ticker([]),
                $ticker(['is_anomaly' => true]),
                $ticker(['is_stale' => true]),
                $ticker(['market' => ['name' => 'Kraken'], 'trade_url' => 'javascript:void(0)']),
                $ticker(['base' => 'XAUT', 'target' => 'LINK', 'coin_id' => 'tether-gold']),
            ]]),
        ]);

        $this->getJson('/api/coin/chainlink/markets')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.exchange', 'Binance')
            ->assertJsonPath('data.0.price', 11.68)
            ->assertJsonPath('data.0.volume', 24247733)
            ->assertJsonPath('data.1.exchange', 'Kraken')
            ->assertJsonPath('data.1.logo', null)
            ->assertJsonPath('data.1.trade_url', null);

        Http::assertSent(fn ($request) => $request['order'] === 'volume_desc');
    }

    public function test_markets_reject_bad_ids(): void
    {
        $this->getJson('/api/coin/bad%20id/markets')->assertStatus(422);
    }
}
