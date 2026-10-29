<?php

namespace App\Http\Controllers;

use App\Support\CoinGecko;
use App\Support\MarketData;
use App\Support\PriceCache;
use App\Support\StaleCache;
use Illuminate\Http\Request;

class CryptoPriceController extends Controller
{
    public function index(Request $request)
    {
        // ?ids=bitcoin,ethereum — the Favorites view.
        if ($request->has('ids')) {
            $ids = self::coinIds($request, MarketData::MAX_FAVORITE_IDS);

            return is_array($ids) ? MarketData::respondCoinsByIds($ids) : $ids;
        }

        $page = filter_var($request->query('page', 1), FILTER_VALIDATE_INT, [
            'options' => ['min_range' => 1, 'max_range' => MarketData::MAX_COIN_PAGES],
        ]);

        if ($page === false) {
            return response()->json([
                'success' => false,
                'error' => 'Invalid page. Use 1 to ' . MarketData::MAX_COIN_PAGES . '.',
            ], 422);
        }

        return MarketData::respondCoinsPage($page);
    }

    /**
     * USD and PHP prices with 24h change for the wallet tracker, every coin
     * in one request: ?ids=bitcoin,ethereum
     */
    public function prices(Request $request)
    {
        $ids = self::coinIds($request, MarketData::MAX_PRICE_IDS);

        return is_array($ids) ? PriceCache::respond($ids) : $ids;
    }

    /**
     * Sorted, de-duplicated, validated ?ids=, or the 422 response to send.
     *
     * @return string[]|\Illuminate\Http\JsonResponse
     */
    private static function coinIds(Request $request, int $max)
    {
        $ids = array_values(array_unique(array_filter(
            explode(',', strtolower((string) $request->query('ids'))),
        )));
        sort($ids);

        $valid = $ids
            && count($ids) <= $max
            && count(preg_grep('/^[a-z0-9-]{1,100}$/', $ids)) === count($ids);

        return $valid ? $ids : response()->json([
            'success' => false,
            'error' => "ids must be 1–{$max} comma-separated coin ids.",
        ], 422);
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

        // Short freshness: the page polls this for its live price.
        return StaleCache::respond("coin_profile_v2_{$id}", 60, fn () => self::fetchProfile($id));
    }

    /**
     * Only what the profile page shows: CoinGecko repeats every market
     * figure in ~60 currencies, and the description contains raw HTML.
     */
    private static function fetchProfile(string $id): array
    {
        $coin = CoinGecko::get("/coins/{$id}", [
            'localization' => 'false',
            'tickers' => 'false',
            'market_data' => 'true',
            'community_data' => 'false',
            'developer_data' => 'false',
            'sparkline' => 'false',
        ]);

        $market = $coin['market_data'] ?? [];
        $usd = fn (string $field) => $market[$field]['usd'] ?? null;

        $description = html_entity_decode(
            strip_tags($coin['description']['en'] ?? ''),
            ENT_QUOTES | ENT_HTML5
        );

        return [
            'id' => $coin['id'] ?? $id,
            'name' => $coin['name'] ?? $id,
            'symbol' => $coin['symbol'] ?? '',
            'image' => $coin['image']['large'] ?? $coin['image']['small'] ?? null,
            'market_cap_rank' => $coin['market_cap_rank'] ?? null,
            'genesis_date' => $coin['genesis_date'] ?? null,
            'hashing_algorithm' => $coin['hashing_algorithm'] ?? null,
            'description' => trim($description),
            'last_updated' => $market['last_updated'] ?? $coin['last_updated'] ?? null,
            'price' => $usd('current_price'),
            'high_24h' => $usd('high_24h'),
            'low_24h' => $usd('low_24h'),
            'price_change_24h' => $usd('price_change_24h_in_currency'),
            'price_change_percentage_1h' => $usd('price_change_percentage_1h_in_currency'),
            'price_change_percentage_24h' => $market['price_change_percentage_24h'] ?? null,
            'price_change_percentage_7d' => $usd('price_change_percentage_7d_in_currency'),
            'price_change_percentage_30d' => $usd('price_change_percentage_30d_in_currency'),
            'price_change_percentage_1y' => $usd('price_change_percentage_1y_in_currency'),
            'market_cap' => $usd('market_cap'),
            'fully_diluted_valuation' => $usd('fully_diluted_valuation'),
            'total_volume' => $usd('total_volume'),
            'circulating_supply' => $market['circulating_supply'] ?? null,
            'total_supply' => $market['total_supply'] ?? null,
            'max_supply' => $market['max_supply'] ?? null,
            'ath' => $usd('ath'),
            'ath_change_percentage' => $usd('ath_change_percentage'),
            'ath_date' => $usd('ath_date'),
            'atl' => $usd('atl'),
            'atl_change_percentage' => $usd('atl_change_percentage'),
            'atl_date' => $usd('atl_date'),
        ];
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

        if (!array_key_exists($days, self::CHART_FRESH_SECONDS)) {
            return response()->json([
                'success' => false,
                'error' => 'Invalid chart timeframe.',
            ], 422);
        }

        return StaleCache::respond(
            "coin_chart_{$id}_{$days}",
            self::CHART_FRESH_SECONDS[$days],
            fn () => self::fetchChart($id, $days),
            fn () => self::chartFromLongerRange($id, (int) $days),
        );
    }

    // Supported ranges (days) => how long a cached chart counts as fresh.
    private const CHART_FRESH_SECONDS = [
        '1' => 120,
        '7' => 600,
        '30' => 900,
        '90' => 1800,
        '365' => 3600,
    ];

    // More points than this add payload and render cost without visible detail.
    private const MAX_CHART_POINTS = 400;

    private static function fetchChart(string $id, string $days): array
    {
        $data = CoinGecko::get("/coins/{$id}/market_chart", [
            'vs_currency' => 'usd',
            'days' => $days,
        ], timeout: 15);

        if (!isset($data['prices']) || !is_array($data['prices']) || count($data['prices']) < 2) {
            throw new \UnexpectedValueException('Invalid chart data.');
        }

        return [
            'prices' => self::downsample($data['prices']),
            'total_volumes' => self::downsample($data['total_volumes'] ?? []),
        ];
    }

    /**
     * When a range has never been cached and CoinGecko is unavailable, cut
     * it out of a longer range we do have (e.g. 7D from cached 30D data).
     */
    private static function chartFromLongerRange(string $id, int $days): ?array
    {
        foreach (array_keys(self::CHART_FRESH_SECONDS) as $longer) {
            if ((int) $longer <= $days) {
                continue;
            }

            $entry = StaleCache::peek("coin_chart_{$id}_{$longer}");
            $prices = $entry['data']['prices'] ?? [];

            if (count($prices) < 2) {
                continue;
            }

            $since = end($prices)[0] - $days * 86_400_000;
            $within = fn (array $points) => array_values(
                array_filter($points, fn ($point) => $point[0] >= $since)
            );

            $sliced = $within($prices);

            if (count($sliced) < 2) {
                continue;
            }

            return [
                ...$entry,
                'data' => [
                    'prices' => $sliced,
                    'total_volumes' => $within($entry['data']['total_volumes'] ?? []),
                ],
            ];
        }

        return null;
    }

    /**
     * Evenly thin a [timestamp, value] series, always keeping the last point.
     */
    private static function downsample(array $points): array
    {
        $count = count($points);

        if ($count <= self::MAX_CHART_POINTS) {
            return array_values($points);
        }

        $step = ($count - 1) / (self::MAX_CHART_POINTS - 1);
        $result = [];

        for ($i = 0; $i < self::MAX_CHART_POINTS; $i++) {
            $result[] = $points[(int) round($i * $step)];
        }

        return $result;
    }
}
