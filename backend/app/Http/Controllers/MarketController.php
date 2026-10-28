<?php

namespace App\Http\Controllers;

use App\Support\MarketData;

class MarketController extends Controller
{
    public function global()
    {
        return MarketData::respond('market_global');
    }

    public function trending()
    {
        return MarketData::respond('trending_coins');
    }

    public function fearGreed()
    {
        return MarketData::respond('fear_greed');
    }
}
