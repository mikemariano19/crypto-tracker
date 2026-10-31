<?php

namespace App\Http\Controllers;

use App\Support\CoinGecko;
use App\Support\CoinSearch;
use App\Support\MarketData;
use App\Support\StaleCache;
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

    // Listed by CoinGecko but not useful to convert into: the IMF's
    // accounting unit and a bolívar replaced in 2018.
    private const SKIPPED_CURRENCIES = ['xdr', 'vef'];

    /**
     * Fiat currencies with their value per 1 USD, for the coin converter:
     * price in X = USD price × per_usd. One call covers every coin.
     */
    public function exchangeRates()
    {
        return StaleCache::respond('exchange_rates_v1', 600, function () {
            $rates = CoinGecko::get('/exchange_rates')['rates'] ?? [];
            $usd = $rates['usd']['value'] ?? null;

            if (!is_numeric($usd) || $usd <= 0) {
                throw new \UnexpectedValueException('Exchange rates have no USD rate.');
            }

            $currencies = [];

            foreach ($rates as $code => $rate) {
                if (($rate['type'] ?? null) !== 'fiat'
                    || in_array($code, self::SKIPPED_CURRENCIES, true)
                    || !preg_match('/^[a-z]{3}$/', (string) $code)
                    || !is_numeric($rate['value'] ?? null)
                    || $rate['value'] <= 0) {
                    continue;
                }

                $currencies[] = [
                    'code' => $code,
                    'name' => (string) ($rate['name'] ?? strtoupper($code)),
                    'unit' => (string) ($rate['unit'] ?? strtoupper($code)),
                    'per_usd' => $rate['value'] / $usd,
                ];
            }

            usort($currencies, fn ($a, $b) => strcmp($a['code'], $b['code']));

            return $currencies;
        });
    }

    /**
     * Top 100 coins (id, name, symbol, image, rank) for the wallet
     * tracker's coin picker. Changes slowly, so browsers keep it a while.
     */
    public function coinList()
    {
        $coins = CoinSearch::top();

        if ($coins === []) {
            return response()->json([
                'success' => false,
                'error' => 'Coin list temporarily unavailable. Please try again shortly.',
            ], 503, ['Retry-After' => 30]);
        }

        return response()
            ->json(['success' => true, 'data' => $coins])
            ->setPublic()
            ->setMaxAge(3600);
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
