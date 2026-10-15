<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class TopGainerController extends Controller
{
    public function index()
    {
        $cacheKey = 'top_gainers';
        $staleKey = 'top_gainers_stale';

        $cached = Cache::get($cacheKey);

        if (is_array($cached)) {
            return response()->json([
                'success' => true,
                'source' => 'cache',
                'data' => $cached,
            ]);
        }

        try {
            $response = Http::timeout(10)->get(
                'https://api.coingecko.com/api/v3/coins/markets',
                [
                    'vs_currency' => 'usd',
                    'order' => 'market_cap_desc',
                    'per_page' => 100,
                    'page' => 1,
                    'price_change_percentage' => '24h',
                ]
            );

            if (!$response->successful()) {
                throw new \RuntimeException(
                    'CoinGecko request failed: ' . $response->status()
                );
            }

            $coins = $response->json();

            if (!is_array($coins) || empty($coins)) {
                throw new \RuntimeException('Invalid market response.');
            }

            $topGainers = collect($coins)
                ->filter(fn ($coin) =>
                    isset($coin['price_change_percentage_24h'])
                    && is_numeric($coin['price_change_percentage_24h'])
                )
                ->sortByDesc('price_change_percentage_24h')
                ->take(3)
                ->values()
                ->all();

            Cache::put($cacheKey, $topGainers, now()->addMinutes(5));
            Cache::put($staleKey, $topGainers, now()->addHours(24));

            return response()->json([
                'success' => true,
                'source' => 'coingecko',
                'data' => $topGainers,
            ]);
        } catch (\Throwable $e) {
            Log::warning('Top gainers fetch failed', [
                'message' => $e->getMessage(),
            ]);

            $stale = Cache::get($staleKey);

            if (is_array($stale)) {
                return response()->json([
                    'success' => true,
                    'source' => 'stale-cache',
                    'stale' => true,
                    'data' => $stale,
                ]);
            }

            return response()->json([
                'success' => false,
                'error' => 'Top gainers temporarily unavailable.',
            ], 503);
        }
    }
}
