<?php

namespace Tests\Feature\Wallet;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class WalletProvidersTest extends TestCase
{
    private const PNG = "\x89PNG\r\n\x1a\nfake-icon-bytes";

    protected function setUp(): void
    {
        parent::setUp();

        Cache::flush();
        Http::preventStrayRequests();

        config()->set('wallet_providers.curated', [
            'ledger' => ['name' => 'Ledger', 'url' => 'https://www.ledger.com', 'kind' => 'wallet'],
            'binance-dup' => ['name' => 'Binance', 'url' => 'https://www.binance.com', 'kind' => 'app'],
            'broken' => ['name' => 'Broken', 'url' => 'https://broken.example', 'kind' => 'wallet'],
        ]);
    }

    private function fakeUpstream(): void
    {
        Http::fake([
            'api.coingecko.com/api/v3/exchanges*' => Http::response([
                ['id' => 'binance', 'name' => 'Binance', 'image' => 'https://coin-images.coingecko.com/markets/images/52/small/binance.jpg', 'trust_score_rank' => 1],
                ['id' => 'kraken', 'name' => 'Kraken', 'image' => 'javascript:alert(1)', 'trust_score_rank' => 2],
            ]),
            'www.ledger.com' => Http::response('<link rel="icon" type="image/png" href="/favicon-32.png">'),
            'www.ledger.com/favicon-32.png' => Http::response(self::PNG, 200, ['Content-Type' => 'image/png']),
            'broken.example' => Http::response('nope', 500),
            'broken.example/favicon.ico' => Http::response(str_repeat('x', 70_000), 200, ['Content-Type' => 'image/x-icon']),
        ]);
    }

    public function test_lists_curated_wallets_and_coingecko_exchanges(): void
    {
        $this->fakeUpstream();
        $this->artisan('wallets:icons')->assertSuccessful();

        $data = $this->getJson('/api/wallet-providers')->assertOk()->json('data');
        $byId = collect($data)->keyBy('id');

        // Curated wallet with an icon served from our own API.
        $this->assertSame('/api/wallet-providers/ledger/icon', $byId['app:ledger']['image']);
        // Too-big icon is dropped: letter tile instead.
        $this->assertNull($byId['app:broken']['image']);
        // A curated entry CoinGecko already lists as an exchange isn't duplicated.
        $this->assertFalse($byId->has('app:binance-dup'));
        $this->assertSame('exchange', $byId['cg:binance']['kind']);
        // Only https images from CoinGecko are passed on.
        $this->assertNull($byId['cg:kraken']['image']);
    }

    public function test_serves_stored_icons_sandboxed(): void
    {
        $this->fakeUpstream();
        $this->artisan('wallets:icons')->assertSuccessful();

        $response = $this->get('/api/wallet-providers/ledger/icon')->assertOk();

        $this->assertSame(self::PNG, $response->getContent());
        $this->assertSame('image/png', $response->headers->get('Content-Type'));
        $this->assertSame('nosniff', $response->headers->get('X-Content-Type-Options'));
        // No script can run if the icon (e.g. an SVG) is opened directly.
        $this->assertStringContainsString("default-src 'none'", $response->headers->get('Content-Security-Policy'));

        $this->get('/api/wallet-providers/broken/icon')->assertNotFound();
        $this->get('/api/wallet-providers/..%2Fsecret/icon')->assertNotFound();
    }

    public function test_icon_lookups_are_not_repeated_while_cached(): void
    {
        $this->fakeUpstream();

        $this->artisan('wallets:icons')->expectsOutputToContain('1 found, 2 missing')->assertSuccessful();
        $this->artisan('wallets:icons')->expectsOutputToContain('3 already cached')->assertSuccessful();
    }
}
