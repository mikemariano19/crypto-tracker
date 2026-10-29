<?php

namespace App\Support;

/**
 * Type-ahead coin search. Matches against the cached top-1,000 index, and
 * only asks CoinGecko (once per query, cached) when that finds too little.
 */
class CoinSearch
{
    public const LIMIT = 8;

    // Below this many local matches, also try CoinGecko's own search.
    private const REMOTE_FALLBACK_BELOW = 3;

    public static function search(string $query): array
    {
        $q = mb_strtolower(trim($query));

        $results = self::searchIndex($q, MarketData::remember('search_index') ?? []);

        if (count($results) < self::REMOTE_FALLBACK_BELOW && mb_strlen($q) >= 3) {
            $seen = array_column($results, 'id');

            foreach (self::searchRemote($q) as $coin) {
                if (!in_array($coin['id'], $seen, true)) {
                    $results[] = $coin;
                }
            }
        }

        return array_slice($results, 0, self::LIMIT);
    }

    /**
     * The biggest coins by market cap, from the cached index: default
     * suggestions before the user has typed anything. No CoinGecko call.
     */
    public static function top(int $limit = 100): array
    {
        $index = MarketData::remember('search_index') ?? [];

        usort($index, fn ($a, $b) => ($a['market_cap_rank'] ?? PHP_INT_MAX) <=> ($b['market_cap_rank'] ?? PHP_INT_MAX));

        return array_slice($index, 0, $limit);
    }

    /**
     * Exact symbol/name first, then prefix matches, then matches at the start
     * of a word, then anywhere; ties go to the bigger coin. So "bit" puts
     * Bitcoin first and "et" puts Ethereum first.
     */
    private static function searchIndex(string $q, array $index): array
    {
        $wordStart = '/(^|[\s\-.(])' . preg_quote($q, '/') . '/u';
        $scored = [];

        foreach ($index as $coin) {
            $name = mb_strtolower($coin['name']);
            $symbol = mb_strtolower($coin['symbol']);

            $tier = match (true) {
                $symbol === $q, $name === $q => 0,
                str_starts_with($symbol, $q), str_starts_with($name, $q) => 1,
                (bool) preg_match($wordStart, $name) => 2,
                str_contains($name, $q), str_contains($symbol, $q) => 3,
                default => null,
            };

            if ($tier !== null) {
                $scored[] = [$tier, $coin['market_cap_rank'] ?? PHP_INT_MAX, $coin];
            }
        }

        usort($scored, fn ($a, $b) => [$a[0], $a[1]] <=> [$b[0], $b[1]]);

        return array_map(fn ($entry) => $entry[2], array_slice($scored, 0, self::LIMIT));
    }

    private static function searchRemote(string $q): array
    {
        return StaleCache::remember('coin_search_' . md5($q), 3600, function () use ($q) {
            $coins = CoinGecko::get('/search', ['query' => $q])['coins'] ?? [];

            return array_map(fn (array $coin) => [
                'id' => $coin['id'],
                'name' => $coin['name'] ?? $coin['id'],
                'symbol' => $coin['symbol'] ?? '',
                'image' => $coin['large'] ?? $coin['thumb'] ?? null,
                'market_cap_rank' => $coin['market_cap_rank'] ?? null,
            ], array_slice($coins, 0, self::LIMIT));
        }) ?? [];
    }
}
