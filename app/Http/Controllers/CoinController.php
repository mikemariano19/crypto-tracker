<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\Http;

class CoinController extends Controller
{
    public function index()
    {
        $response = Http::get('https://api.coinmarketcap.com/api/v3/simple/price', [
            'ids'  => 'bitcoin,ethereum,ripple,litecoin,cardano',
            'vs_curencies' => 'USD'
        ]);

        $data = $response->json();

        return view('home', compact('data'));
    }
}