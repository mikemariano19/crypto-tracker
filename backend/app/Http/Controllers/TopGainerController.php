<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class TopGainerController extends Controller
{
    public function index()
    {
        $cacheKey = 'top-gainers';
        $staleCacheKey = 'top-gainers_stale';

        try {
            $data = Cache::remember($cacheKey, 60, function () use ($staleCacheKey) {
                $response = Http::timeout(10)->get(
                    'https://api.coingecko.com/api/v3/coins/markets',
                    [
                        'vs_currency' => 'usd',
                        'order'       => 'market_cap_desc',
                        'per_page'    => 1000,
                        'price_change_percentage' => '1h,24h,7d',
                        'market_cap_desc' => 'true',
                    ]
                );

                $json = $response->json();

                // Sort descending by 24h %
                usort($json, function ($a, $b) {
                    return $b['price_change_percentage_24h'] <=> $a['price_change_percentage_24h'];
                });

                // Top 10 gainers
                $topGainers = array_slice($json, 0, 3);


                if (!$response->successful() || !is_array($json) || empty($json)) {
                    Log::warning('CoinGecko fetch failed or returned bad data', [
                        'status' => $response->status(),
                        'body'   => $response->body(),
                    ]);
                    return null; // don't cache bad data
                }

                // Save a long-lived stale copy as fallback
                Cache::put($staleCacheKey, $json, now()->addHours(24));

                return response()->json([
                    'success' => true,
                    'data'    => $topGainers,
                ]);
            });

            // If fresh fetch failed, fall back to stale data
            if ($data === null) {
                $data = Cache::get($staleCacheKey);
            }

            if ($data === null) {
                return response()->json([
                    'error'   => 'Unable to fetch prices. Please try again later.',
                    'success' => false,
                ], 503);
            }

            return response()->json([
                'success' => true,
                'data'    => $data,
                'cached_at' => now()->toISOString(),
            ]);

        } catch (\Exception $e) {
            Log::error('TopGainerController error', ['message' => $e->getMessage()]);

            $stale = Cache::get($staleCacheKey);

            if ($stale) {
                return response()->json([
                    'success'  => true,
                    'data'     => $stale,
                    'stale'    => true,
                    'cached_at' => now()->toISOString(),
                ]);
            }

            return response()->json([
                'error'   => 'Service temporarily unavailable.',
                'success' => false,
            ], 503);
        }
    }
}