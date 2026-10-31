<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class ExchangeRatesTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Cache::flush();
        Http::preventStrayRequests();
    }

    public function test_lists_fiat_currencies_per_usd(): void
    {
        Http::fake([
            'api.coingecko.com/api/v3/exchange_rates' => Http::response(['rates' => [
                'btc' => ['name' => 'Bitcoin', 'unit' => 'BTC', 'value' => 1, 'type' => 'crypto'],
                'usd' => ['name' => 'US Dollar', 'unit' => '$', 'value' => 80000, 'type' => 'fiat'],
                'php' => ['name' => 'Philippine Peso', 'unit' => '₱', 'value' => 4640000, 'type' => 'fiat'],
                'eur' => ['name' => 'Euro', 'unit' => '€', 'value' => 72000, 'type' => 'fiat'],
                'xdr' => ['name' => 'IMF Special Drawing Rights', 'unit' => 'XDR', 'value' => 60000, 'type' => 'fiat'],
                'xau' => ['name' => 'Gold', 'unit' => 'oz', 'value' => 20, 'type' => 'commodity'],
            ]]),
        ]);

        $this->getJson('/api/exchange-rates')
            ->assertOk()
            ->assertJsonCount(3, 'data')
            ->assertJsonPath('data.0.code', 'eur')
            ->assertJsonPath('data.0.per_usd', 0.9)
            ->assertJsonPath('data.1.code', 'php')
            ->assertJsonPath('data.1.per_usd', 58)
            ->assertJsonPath('data.2.code', 'usd')
            ->assertJsonPath('data.2.per_usd', 1);

        // Cached: a second request doesn't call CoinGecko again.
        $this->getJson('/api/exchange-rates')->assertOk();
        Http::assertSentCount(1);
    }
}
