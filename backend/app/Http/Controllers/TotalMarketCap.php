<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\Http;


class TotalMarketCap extends Controller
{
    public function TotalMarketCap()
    {
        $response = Http::timeout(10)->get('https://api.coingecko.com/api/v3/global');

        if (!$response->successful()) {
            return response()->json([
                'error'   => 'Unable to fetch market stats. Please try again later.',
                'success' => false,
            ], 503);
        }

        $json = $response->json();

        if (!is_array($json) || empty($json['data'])) {
            return response()->json([
                'error'   => 'Invalid data received from CoinGecko.',
                'success' => false,
            ], 502);
        }

        return response()->json([
            'success' => true,
            'data'    => $json['data'],
            'cached_at' => now()->toISOString(),
        ]);
    }
}