<?php

namespace App\Http\Controllers;


use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class CryptoPriceController extends Controller
{
    public function index()
    {
        $cacheKey = 'coins';
        $staleKey = 'coins_stale';

        try {
            $cached = Cache::get($cacheKey);

            if (is_array($cached) && !empty($cached)) {
                return response()->json([
                    'success' => true,
                    'source' => 'cache',
                    'data' => $cached,
                    'cached_at' => Cache::get('coins_cached_at'),
                ]);
            }

            $response = Http::timeout(10)->get(
                'https://api.coingecko.com/api/v3/coins/markets',
                [
                    'vs_currency' => 'usd',
                    'order' => 'market_cap_desc',
                    'per_page' => 50,
                    'page' => 1,
                    'price_change_percentage' => '1h,24h,7d',
                ]
            );

            if (!$response->successful()) {
                Log::warning('CoinGecko market request failed', [
                    'status' => $response->status(),
                ]);

                return $this->staleResponse($staleKey, 'Prices temporarily unavailable.');
            }

            $data = $response->json();

            if (!is_array($data) || empty($data)) {
                return $this->staleResponse($staleKey, 'Invalid market data.');
            }

            $now = now()->toISOString();

            Cache::put($cacheKey, $data, now()->addMinutes(2));
            Cache::put($staleKey, $data, now()->addHours(24));
            Cache::put('coins_cached_at', $now, now()->addHours(24));

            return response()->json([
                'success' => true,
                'source' => 'coingecko',
                'data' => $data,
                'cached_at' => $now,
            ]);
        } catch (\Throwable $e) {
            Log::error('Crypto market fetch failed', [
                'message' => $e->getMessage(),
            ]);

            return $this->staleResponse($staleKey, 'Service temporarily unavailable.');
        }
    }

    public function coin(string $id)
    {
        // Validate IDs before using them in an upstream URL.
        if (!preg_match('/^[a-zA-Z0-9-]+$/', $id)) {
            return response()->json([
                'success' => false,
                'error' => 'Invalid coin ID.',
            ], 422);
        }

        $cacheKey = "coin_details_{$id}";
        $staleKey = "coin_details_stale_{$id}";

        try {
            $cached = Cache::get($cacheKey);

            if (is_array($cached) && !empty($cached)) {
                return response()->json([
                    'success' => true,
                    'source' => 'cache',
                    'data' => $cached,
                ]);
            }

            $response = Http::timeout(10)->get(
                "https://api.coingecko.com/api/v3/coins/{$id}",
                [
                    'localization' => 'false',
                    'tickers' => 'false',
                    'market_data' => 'true',
                    'community_data' => 'false',
                    'developer_data' => 'false',
                    'sparkline' => 'false',
                ]
            );

            if (!$response->successful()) {
                Log::warning('Coin details request failed', [
                    'coin' => $id,
                    'status' => $response->status(),
                ]);

                if ($response->status() === 404) {
                    return response()->json([
                        'success' => false,
                        'error' => 'Coin not found.',
                    ], 404);
                }

                return $this->staleResponse(
                    $staleKey,
                    'Coin details temporarily unavailable.'
                );
            }

            $data = $response->json();

            if (!is_array($data) || empty($data)) {
                return $this->staleResponse($staleKey, 'Invalid coin data.');
            }

            Cache::put($cacheKey, $data, now()->addMinutes(5));
            Cache::put($staleKey, $data, now()->addHours(24));

            return response()->json([
                'success' => true,
                'source' => 'coingecko',
                'data' => $data,
            ]);
        } catch (\Throwable $e) {
            Log::error('Coin details fetch failed', [
                'coin' => $id,
                'message' => $e->getMessage(),
            ]);

            return $this->staleResponse(
                $staleKey,
                'Coin details temporarily unavailable.'
            );
        }
    }

    public function chart(string $id, Request $request)
    {
        if (!preg_match('/^[a-zA-Z0-9-]+$/', $id)) {
            return response()->json([
                'success' => false,
                'error' => 'Invalid coin ID.',
            ], 422);
        }

        $days = (string) $request->query('days', '7');

        if (!in_array($days, ['1', '7', '30', '365'], true)) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid chart timeframe.',
            ], 422);
        }

        $cacheKey = "coin_chart_{$id}_{$days}";
        $staleKey = "coin_chart_stale_{$id}_{$days}";

        try {
            $cached = Cache::get($cacheKey);

            if (is_array($cached) && isset($cached['prices'])) {
                return response()->json([
                    'success' => true,
                    'source' => 'cache',
                    'data' => $cached,
                ]);
            }

            $response = Http::timeout(15)->get(
                "https://api.coingecko.com/api/v3/coins/{$id}/market_chart",
                [
                    'vs_currency' => 'usd',
                    'days' => $days,
                ]
            );

            if (!$response->successful()) {
                Log::warning('CoinGecko chart request failed', [
                    'coin' => $id,
                    'days' => $days,
                    'status' => $response->status(),
                ]);

                return $this->staleResponse(
                    $staleKey,
                    'Chart temporarily unavailable.'
                );
            }

            $data = $response->json();

            if (!is_array($data) || !isset($data['prices'])) {
                return $this->staleResponse($staleKey, 'Invalid chart data.');
            }

            // Cache successful responses only.
            Cache::put($cacheKey, $data, now()->addMinutes(5));
            Cache::put($staleKey, $data, now()->addHours(24));

            return response()->json([
                'success' => true,
                'source' => 'coingecko',
                'data' => $data,
            ]);
        } catch (\Throwable $e) {
            Log::error('Chart fetch failed', [
                'coin' => $id,
                'days' => $days,
                'message' => $e->getMessage(),
            ]);

            return $this->staleResponse(
                $staleKey,
                'Chart temporarily unavailable.'
            );
        }
    }

    private function staleResponse(string $staleKey, string $message)
    {
        $stale = Cache::get($staleKey);

        if (is_array($stale) && !empty($stale)) {
            return response()->json([
                'success' => true,
                'source' => 'stale-cache',
                'stale' => true,
                'data' => $stale,
                'message' => $message,
            ]);
        }

        return response()->json([
            'success' => false,
            'error' => $message,
        ], 503);
    }
}
