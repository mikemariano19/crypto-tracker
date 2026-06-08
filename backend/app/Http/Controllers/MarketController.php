<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Cache;


class MarketController extends Controller
{
   public function global()
{
    $cacheKey = 'market_global';
    $cacheTTL = 60; // 1 minute cache

    try {
        $response = Http::timeout(10)
            ->get('https://api.coingecko.com/api/v3/global');

        if ($response->successful() && isset($response->json()['data'])) {

            $data = $response->json()['data'];

            $result = [
                'success' => true,
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

            // store latest good data
            Cache::put($cacheKey, $result, 3600); // keep backup for 1 hour

            return response()->json($result);
        }
    } catch (\Exception $e) {
        // ignore error, fallback below
    }

    // fallback to cache
    if (Cache::has($cacheKey)) {
        $cached = Cache::get($cacheKey);

        $cached['success'] = true;
        $cached['from_cache'] = true;

        return response()->json($cached);
    }

    // last resort fallback
    return response()->json([
        'success' => false,
        'error' => 'Unable to fetch data and no cache available.',
    ], 503);
}



   public function trending()
{
    $cacheKey = 'market_trending';

    try {
        $response = Http::timeout(10)
            ->get('https://api.coingecko.com/api/v3/search/trending');

        if ($response->successful()) {

            $result = [
                'success' => true,
                'data' => $response->json(),
                'cached_at' => now()->toISOString(),
            ];

            Cache::put($cacheKey, $result, 3600);

            return response()->json($result);
        }

    } catch (\Exception $e) {
        // ignore
    }

    // fallback cache
    if (Cache::has($cacheKey)) {
        $cached = Cache::get($cacheKey);
        $cached['from_cache'] = true;

        return response()->json($cached);
    }

    return response()->json([
        'success' => false,
        'error' => 'No data available.',
    ], 503);
}
}