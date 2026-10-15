<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class MarketController extends Controller
{
    public function global()
    {
        return $this->cachedEndpoint(
            cacheKey: 'market_global',
            staleKey: 'market_global_stale',
            ttlMinutes: 5,
            fetch: function () {
                $response = Http::timeout(10)->get(
                    'https://api.coingecko.com/api/v3/global'
                );

                if (!$response->successful()) {
                    throw new \RuntimeException(
                        'CoinGecko global request failed: ' . $response->status()
                    );
                }

                $data = $response->json('data');

                if (!is_array($data)) {
                    throw new \RuntimeException('Invalid global market data.');
                }

                return [
                    'market_cap' => $data['total_market_cap']['usd'] ?? 0,
                    'volume_24h' => $data['total_volume']['usd'] ?? 0,
                    'btc_dominance' => $data['market_cap_percentage']['btc'] ?? 0,
                    'eth_dominance' => $data['market_cap_percentage']['eth'] ?? 0,
                    'change_24h' => $data['market_cap_change_percentage_24h_usd'] ?? 0,
                    'active_cryptocurrencies' => $data['active_cryptocurrencies'] ?? 0,
                ];
            }
        );
    }

    public function trending()
    {
        return $this->cachedEndpoint(
            cacheKey: 'market_trending',
            staleKey: 'market_trending_stale',
            ttlMinutes: 5,
            fetch: function () {
                $response = Http::timeout(10)->get(
                    'https://api.coingecko.com/api/v3/search/trending'
                );

                if (!$response->successful()) {
                    throw new \RuntimeException(
                        'CoinGecko trending request failed: ' . $response->status()
                    );
                }

                return collect($response->json('coins', []))
                    ->take(3)
                    ->values()
                    ->all();
            }
        );
    }

    private function cachedEndpoint(
        string $cacheKey,
        string $staleKey,
        int $ttlMinutes,
        callable $fetch
    ) {
        $cached = Cache::get($cacheKey);

        if (is_array($cached)) {
            return response()->json([
                'success' => true,
                'source' => 'cache',
                ...$cached,
            ]);
        }

        try {
            $data = $fetch();

            $result = [
                'success' => true,
                'source' => 'coingecko',
                'data' => $data,
                'cached_at' => now()->toISOString(),
            ];

            Cache::put($cacheKey, $result, now()->addMinutes($ttlMinutes));
            Cache::put($staleKey, $result, now()->addHours(24));

            return response()->json($result);
        } catch (\Throwable $e) {
            Log::warning('Market endpoint fetch failed', [
                'cache_key' => $cacheKey,
                'message' => $e->getMessage(),
            ]);

            $stale = Cache::get($staleKey);

            if (is_array($stale)) {
                $stale['source'] = 'stale-cache';
                $stale['stale'] = true;

                return response()->json($stale);
            }

            return response()->json([
                'success' => false,
                'error' => 'Market data temporarily unavailable.',
            ], 503);
        }
    }
}
