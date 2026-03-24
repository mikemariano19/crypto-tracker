<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\Http;

class CoinController extends Controller
{
    public function index()
    {
        $response = Http::get('https://api.coingecko.com/api/v3/coins/markets', [
            'vs_currency' => 'usd',
            'order' => 'market_cap_desc',
            'per_page' => 50,
            'page' => 1,
            'price_change_percentage' => '1h,24h,7d',
            'sparkline' => false
        ]);

        $coins = $response->json();

        return view('home', compact('coins'));
    }
}