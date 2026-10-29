<?php

namespace App\Support;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;

/**
 * Upstream fetchers for the dashboard endpoints, keyed for StaleCache.
 * Shared by the controllers and the `market:warm` scheduled command.
 *
 * Responses are trimmed to the fields the frontend renders, which keeps
 * payloads small (CoinGecko's trending data alone carries ~60 currencies
 * per coin).
 */
class MarketData
{
    public const TOP_GAINERS_LIMIT = 50;

    public const COINS_PER_PAGE = 50;

    // Top 1,000 coins. Past that it's mostly illiquid tokens, and every page
    // is another CoinGecko call against a tight free-tier rate limit.
    public const MAX_COIN_PAGES = 20;

    // Most favorites one table request can ask for.
    public const MAX_FAVORITE_IDS = 100;

    // Most coins one wallet-tracker price request can ask for.
    public const MAX_PRICE_IDS = 250;

    // Search suggestions come from a local index of the top 1,000 coins
    // (4 × 250), so typing never spends CoinGecko calls.
    private const SEARCH_INDEX_PAGES = 4;

    /**
     * Cache key => [fresh seconds, fetcher].
     *
     * @return array<string, array{0: int, 1: callable}>
     */
    public static function endpoints(): array
    {
        return [
            'coins' => [120, [self::class, 'coins']],
            'top_gainers_50' => [300, [self::class, 'topGainers']],
            'market_global' => [300, [self::class, 'global']],
            'trending_coins' => [300, [self::class, 'trending']],
            // The index itself only changes once a day.
            'fear_greed' => [3600, [self::class, 'fearGreed']],
            // Names and ranks barely move; rebuild twice a day.
            'search_index' => [43200, [self::class, 'searchIndex']],
        ];
    }

    /**
     * Data for a cache key without an HTTP response (null if unavailable).
     */
    public static function remember(string $key): ?array
    {
        [$freshSeconds, $fetch] = self::endpoints()[$key];

        return StaleCache::remember($key, $freshSeconds, $fetch);
    }

    public static function respond(string $key)
    {
        [$freshSeconds, $fetch] = self::endpoints()[$key];

        return StaleCache::respond($key, $freshSeconds, $fetch);
    }

    /**
     * One page of the market table. Page 1 is the shared 'coins' entry the
     * warm command keeps fresh; deeper pages are cached on demand.
     */
    public static function respondCoinsPage(int $page)
    {
        return $page === 1
            ? self::respond('coins')
            : StaleCache::respond("coins_page_{$page}", 180, fn () => self::coins($page));
    }

    /**
     * Table rows for specific coins (the Favorites view), whatever their rank.
     *
     * @param  string[]  $ids  validated, sorted CoinGecko ids
     */
    public static function respondCoinsByIds(array $ids)
    {
        $key = 'coins_ids_' . md5(implode(',', $ids));

        return StaleCache::respond($key, 120, fn () => self::coins(1, $ids));
    }

    public static function coins(int $page = 1, array $ids = []): array
    {
        $coins = CoinGecko::get('/coins/markets', [
            'vs_currency' => 'usd',
            'order' => 'market_cap_desc',
            'per_page' => $ids ? 250 : self::COINS_PER_PAGE,
            'page' => $page,
            'price_change_percentage' => '1h,24h,7d',
            ...($ids ? ['ids' => implode(',', $ids)] : []),
        ]);

        return array_map(fn (array $coin) => [
            'id' => $coin['id'] ?? null,
            'name' => $coin['name'] ?? null,
            'symbol' => $coin['symbol'] ?? null,
            'image' => $coin['image'] ?? null,
            'market_cap_rank' => $coin['market_cap_rank'] ?? null,
            'current_price' => $coin['current_price'] ?? null,
            'market_cap' => $coin['market_cap'] ?? null,
            'total_volume' => $coin['total_volume'] ?? null,
            'price_change_percentage_1h_in_currency' => $coin['price_change_percentage_1h_in_currency'] ?? null,
            'price_change_percentage_24h' => $coin['price_change_percentage_24h'] ?? null,
            'price_change_percentage_7d_in_currency' => $coin['price_change_percentage_7d_in_currency'] ?? null,
        ], $coins);
    }

    /**
     * Biggest positive 24h movers among the top 250 coins by market cap.
     */
    public static function topGainers(): array
    {
        $coins = CoinGecko::get('/coins/markets', [
            'vs_currency' => 'usd',
            'order' => 'market_cap_desc',
            'per_page' => 250,
            'page' => 1,
            'price_change_percentage' => '24h',
        ]);

        return collect($coins)
            ->filter(fn ($coin) =>
                isset($coin['price_change_percentage_24h'])
                && is_numeric($coin['price_change_percentage_24h'])
                && $coin['price_change_percentage_24h'] > 0
            )
            ->sortByDesc('price_change_percentage_24h')
            ->take(self::TOP_GAINERS_LIMIT)
            ->map(fn (array $coin) => [
                'id' => $coin['id'],
                'name' => $coin['name'] ?? null,
                'symbol' => $coin['symbol'] ?? null,
                'image' => $coin['image'] ?? null,
                'market_cap_rank' => $coin['market_cap_rank'] ?? null,
                'price' => $coin['current_price'] ?? null,
                'market_cap' => $coin['market_cap'] ?? null,
                'price_change_percentage_24h' => (float) $coin['price_change_percentage_24h'],
            ])
            ->values()
            ->all();
    }

    public static function global(): array
    {
        $data = CoinGecko::get('/global')['data'] ?? null;

        if (!is_array($data)) {
            throw new \UnexpectedValueException('Invalid global market data.');
        }

        return [
            'market_cap' => $data['total_market_cap']['usd'] ?? 0,
            'volume_24h' => $data['total_volume']['usd'] ?? 0,
            'btc_dominance' => $data['market_cap_percentage']['btc'] ?? 0,
            'eth_dominance' => $data['market_cap_percentage']['eth'] ?? 0,
            'change_24h' => $data['market_cap_change_percentage_24h_usd'] ?? 0,
            'active_cryptocurrencies' => $data['active_cryptocurrencies'] ?? 0,
        ];
    }

    /**
     * Every trending coin CoinGecko reports (15 on the public API).
     */
    public static function trending(): array
    {
        $coins = CoinGecko::get('/search/trending')['coins'] ?? [];

        if (empty($coins)) {
            throw new \UnexpectedValueException('Invalid trending data.');
        }

        return collect($coins)
            ->pluck('item')
            ->filter(fn ($item) => is_array($item) && isset($item['id']))
            ->map(fn (array $item) => [
                'id' => $item['id'],
                'name' => $item['name'] ?? null,
                'symbol' => $item['symbol'] ?? null,
                'image' => $item['large'] ?? $item['small'] ?? null,
                'market_cap_rank' => $item['market_cap_rank'] ?? null,
                'price' => $item['data']['price'] ?? null,
                // CoinGecko sends market cap here as a formatted string ("$1,234").
                'market_cap' => self::parseMoney($item['data']['market_cap'] ?? null),
                'price_change_percentage_24h' => $item['data']['price_change_percentage_24h']['usd'] ?? null,
            ])
            ->values()
            ->all();
    }

    /**
     * Crypto Fear & Greed Index (alternative.me, free, no key), with
     * yesterday's value for the daily change.
     */
    public static function fearGreed(): array
    {
        $days = Http::acceptJson()
            ->timeout(10)
            ->retry(2, 300, fn ($e) => $e instanceof ConnectionException)
            ->get('https://api.alternative.me/fng/', ['limit' => 2])
            ->throw()
            ->json('data');

        $today = $days[0] ?? null;

        if (!is_array($today) || !is_numeric($today['value'] ?? null)) {
            throw new \UnexpectedValueException('Invalid Fear & Greed data.');
        }

        $yesterday = $days[1]['value'] ?? null;

        return [
            'value' => (int) $today['value'],
            'classification' => $today['value_classification'] ?? null,
            'previous_value' => is_numeric($yesterday) ? (int) $yesterday : null,
            'updated_at' => isset($today['timestamp'])
                ? now()->setTimestamp((int) $today['timestamp'])->toISOString()
                : null,
        ];
    }

    /**
     * Compact list of the top 1,000 coins for search suggestions.
     */
    public static function searchIndex(): array
    {
        $index = [];

        for ($page = 1; $page <= self::SEARCH_INDEX_PAGES; $page++) {
            $coins = CoinGecko::get('/coins/markets', [
                'vs_currency' => 'usd',
                'order' => 'market_cap_desc',
                'per_page' => 250,
                'page' => $page,
            ]);

            foreach ($coins as $coin) {
                if (!isset($coin['id'], $coin['name'], $coin['symbol'])) {
                    continue;
                }

                $index[] = [
                    'id' => $coin['id'],
                    'name' => $coin['name'],
                    'symbol' => $coin['symbol'],
                    'image' => $coin['image'] ?? null,
                    'market_cap_rank' => $coin['market_cap_rank'] ?? null,
                ];
            }
        }

        return $index;
    }

    private static function parseMoney(mixed $value): ?float
    {
        if (is_numeric($value)) {
            return (float) $value;
        }

        $digits = is_string($value) ? preg_replace('/[^0-9.]/', '', $value) : '';

        return $digits !== '' ? (float) $digits : null;
    }
}
