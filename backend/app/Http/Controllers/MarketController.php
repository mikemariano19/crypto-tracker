<?php

namespace App\Http\Controllers;

use App\Support\CoinSearch;
use App\Support\MarketData;
use Illuminate\Http\Request;

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

    public function search(Request $request)
    {
        $query = trim((string) $request->query('q', ''));

        if ($query === '' || mb_strlen($query) > 40 || !preg_match('/^[\p{L}\p{N} .\-]+$/u', $query)) {
            return response()->json([
                'success' => false,
                'error' => 'Search must be 1–40 letters, numbers, spaces, dots or dashes.',
            ], 422);
        }

        return response()
            ->json(['success' => true, 'data' => CoinSearch::search($query)])
            ->setPublic()
            ->setMaxAge(300);
    }
}
