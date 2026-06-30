<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Cache;

class MarketController extends Controller
{
    public function global()
    {
        $cacheKey = 'market_global';
        $cacheTTL = 60; // seconds

        // Return cached data first
        if (Cache::has($cacheKey)) {
            $cached = Cache::get($cacheKey);
            $cached['source'] = 'cache';

            return response()->json($cached);
        }

        try {
            $response = Http::timeout(10)
                ->get('https://api.coingecko.com/api/v3/global');

            if (!$response->successful()) {
                throw new \Exception('CoinGecko request failed');
            }

            $data = $response->json()['data'];

            $result = [
                'success' => true,
                'source' => 'coingecko',
                'data' => [
                    'market_cap' => $data['total_market_cap']['usd'],
                    'volume_24h' => $data['total_volume']['usd'],
                    'btc_dominance' => $data['market_cap_percentage']['btc'],
                    'eth_dominance' => $data['market_cap_percentage']['eth'],
                    'change_24h' => $data['market_cap_change_percentage_24h_usd'],
                    'active_cryptocurrencies' => $data['active_cryptocurrencies'],
                ],
                'cached_at' => now()->toISOString(),
            ];

            Cache::put($cacheKey, $result, now()->addSeconds($cacheTTL));

            return response()->json($result);

        } catch (\Exception $e) {

            // fallback if cache somehow exists
            if (Cache::has($cacheKey)) {
                $cached = Cache::get($cacheKey);
                $cached['source'] = 'cache-fallback';

                return response()->json($cached);
            }

            return response()->json([
                'success' => false,
                'error' => 'Unable to fetch market stats',
            ], 503);
        }
    }

    public function trending()
    {
        $cacheKey = 'market_trending';
        $cacheTTL = 300; // 5 minutes

        // Return cache first
        if (Cache::has($cacheKey)) {
            $cached = Cache::get($cacheKey);
            $cached['source'] = 'cache';

            return response()->json($cached);
        }

        try {
            $response = Http::timeout(10)
                ->get('https://api.coingecko.com/api/v3/search/trending');

            if (!$response->successful()) {
                throw new \Exception('CoinGecko request failed');
            }

            $coins = collect($response->json('coins'))
                ->take(3)
                ->values()
                ->all();

            $result = [
                'success' => true,
                'source' => 'coingecko',
                'coins' => $coins,
                'cached_at' => now()->toISOString(),
            ];

            Cache::put($cacheKey, $result, now()->addSeconds($cacheTTL));

            return response()->json($result);

        } catch (\Exception $e) {

            if (Cache::has($cacheKey)) {
                $cached = Cache::get($cacheKey);
                $cached['source'] = 'cache-fallback';

                return response()->json($cached);
            }

            return response()->json([
                'success' => false,
                'error' => 'Unable to fetch trending coins',
            ], 503);
        }
    }
}