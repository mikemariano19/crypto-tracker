<?php

namespace App\Http\Controllers;



class CryptoPriceController extends Controller
{
   public function index()
{
    return response()->json(
        cache()->remember('coins', 30, function () {
            return \Illuminate\Support\Facades\Http::get(
                'https://api.coingecko.com/api/v3/coins/markets',
                [
                    'vs_currency' => 'usd',
                    'order' => 'market_cap_desc',
                    'per_page' => 50,
                    'price_change_percentage' => '1h,24h,7d'
                ]
            )->json();
        })
    );
}
}
