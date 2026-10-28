<?php

namespace App\Http\Controllers;

use App\Support\MarketData;

class TopGainerController extends Controller
{
    public function index()
    {
        return MarketData::respond('top_gainers_50');
    }
}
