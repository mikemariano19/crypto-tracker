<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\Http;


class MarketController extends Controller
{
    public function global()
    {
        $response = Http::timeout(10)->get('https://api.coingecko.com/api/v3/global');

        if (!$response->successful()) {
            return response()->json([
                'error'   => 'Unable to fetch market stats. Please try again later.',
                'success' => false,
            ], 503);
        }

       $json = $response->json();

        if (!isset($json['data'])) {
            return response()->json([
                'success' => false,
                'error' => 'Invalid data received.'
            ], 502);
        }

        $data = $json['data'];

        return response()->json([
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
        ]);
    }

    public function trending()
        {
            $response = Http::get(
                'https://api.coingecko.com/api/v3/search/trending'
            );

            return response()->json($response->json());
        }
}