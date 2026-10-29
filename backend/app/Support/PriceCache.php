<?php

namespace App\Support;

use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * USD/PHP prices cached per coin, so every request (any portfolio, any
 * future feature) shares them. A request only asks CoinGecko for coins
 * that are missing or older than the freshness window, all in one call.
 *
 * Same spirit as StaleCache: when CoinGecko is down, the last good price
 * of each coin is served and marked stale; upstream is left alone for a
 * cooldown after a failure.
 */
class PriceCache
{
    public const FRESH_SECONDS = 60;

    // How long a last-good price is kept as a fallback.
    private const KEEP_FOR_DAYS = 7;

    // Coins CoinGecko doesn't know aren't asked about again for this long.
    private const UNKNOWN_FRESH_SECONDS = 3600;

    // When a reply has no prices at all it may be a glitch rather than
    // unknown coins, so those coins are re-checked much sooner.
    private const EMPTY_REPLY_FRESH_SECONDS = 300;

    // /simple/price ids per upstream call (URL length stays reasonable).
    private const IDS_PER_CALL = 250;

    private const COOLDOWN_KEY = 'price:cooldown';

    private const DEFAULT_COOLDOWN_SECONDS = 60;

    /**
     * @param  string[]  $ids  validated CoinGecko ids
     */
    public static function respond(array $ids): JsonResponse
    {
        $result = self::quotes($ids);

        if ($result['data'] === [] && $result['missing'] !== []) {
            return StaleCache::unavailable();
        }

        $fetchedAt = $result['oldest_fetched_at'] ?? now()->getTimestamp();

        return StaleCache::jsonResponse(
            (object) $result['data'], // {} even when empty
            now()->setTimestamp($fetchedAt)->toISOString(),
            $result['source'],
            $result['stale'],
            $result['version'],
        );
    }

    /**
     * Quotes for the given coins, refreshing stale ones first.
     *
     * @param  string[]  $ids
     * @return array{
     *     data: array<string, array>,
     *     stale: bool,
     *     source: string,
     *     oldest_fetched_at: ?int,
     *     missing: string[],
     *     version: string,
     * }
     */
    public static function quotes(array $ids): array
    {
        $entries = self::entries($ids);
        $refreshed = false;

        $needed = array_values(array_filter($ids, fn ($id) => !self::isFresh($entries[$id])));

        if ($needed !== [] && !Cache::has(self::COOLDOWN_KEY)) {
            $lock = Cache::lock('price:refresh', 20);

            try {
                // Wait briefly: another request may be fetching these very coins.
                $lock->block(5);

                // Re-check: whatever that request fetched is fresh now.
                $entries = [...$entries, ...self::entries($needed)];
                $needed = array_values(array_filter($needed, fn ($id) => !self::isFresh($entries[$id])));

                if ($needed !== []) {
                    $entries = [...$entries, ...self::refresh($needed)];
                    $refreshed = true;
                }
            } catch (LockTimeoutException) {
                // Serve what we have; the next request will try again.
            } finally {
                $lock->release();
            }
        }

        $data = [];
        $missing = [];
        $stale = false;
        $fetchedAt = [];

        foreach ($ids as $id) {
            $entry = $entries[$id];

            if (!$entry) {
                $missing[] = $id;
                $stale = true;

                continue;
            }

            if (!self::isFresh($entry)) {
                $stale = true;
            }

            if ($entry['quote'] !== null) {
                $data[$id] = $entry['quote'];
                $fetchedAt[$id] = $entry['fetched_at'];
            }
        }

        return [
            'data' => $data,
            'stale' => $stale,
            'source' => $refreshed ? 'upstream' : ($stale ? 'stale-cache' : 'cache'),
            'oldest_fetched_at' => $fetchedAt ? min($fetchedAt) : null,
            'missing' => $missing,
            'version' => json_encode($fetchedAt),
        ];
    }

    /**
     * Fetch the given coins from CoinGecko and store each one. Returns the
     * new entries; coins that failed keep no new entry (old one stays).
     *
     * @param  string[]  $ids
     * @return array<string, array>
     */
    private static function refresh(array $ids): array
    {
        $stored = [];

        foreach (array_chunk($ids, self::IDS_PER_CALL) as $chunk) {
            try {
                $prices = CoinGecko::get('/simple/price', [
                    'ids' => implode(',', $chunk),
                    'vs_currencies' => 'usd,php',
                    'include_24hr_change' => 'true',
                    'include_last_updated_at' => 'true',
                ]);
            } catch (\UnexpectedValueException) {
                // CoinGecko answered {}: it knows none of these coins.
                $prices = [];
            } catch (CoinGeckoBusy) {
                // CoinGecko keeps its own block; serve what's cached.
                break;
            } catch (\Throwable $e) {
                self::startCooldown($e);

                break;
            }

            $now = now()->getTimestamp();
            $unknownFor = $prices === [] ? self::EMPTY_REPLY_FRESH_SECONDS : self::UNKNOWN_FRESH_SECONDS;
            $batch = [];

            foreach ($chunk as $id) {
                $coin = $prices[$id] ?? null;

                $batch[self::key($id)] = $stored[$id] = is_array($coin)
                    ? ['quote' => self::quote($coin), 'fetched_at' => $now]
                    : ['quote' => null, 'fetched_at' => $now, 'unknown_for' => $unknownFor];
            }

            Cache::putMany($batch, now()->addDays(self::KEEP_FOR_DAYS));
        }

        return $stored;
    }

    private static function quote(array $coin): array
    {
        return [
            'usd' => $coin['usd'] ?? null,
            'php' => $coin['php'] ?? null,
            'usd_24h_change' => $coin['usd_24h_change'] ?? null,
            'php_24h_change' => $coin['php_24h_change'] ?? null,
            'last_updated_at' => $coin['last_updated_at'] ?? null,
        ];
    }

    /**
     * @param  string[]  $ids
     * @return array<string, ?array> id => stored entry or null
     */
    private static function entries(array $ids): array
    {
        $keys = array_map(self::key(...), $ids);
        $values = Cache::many($keys);

        $entries = [];

        foreach ($ids as $i => $id) {
            $entry = $values[$keys[$i]] ?? null;
            $entries[$id] = is_array($entry) && array_key_exists('quote', $entry) ? $entry : null;
        }

        return $entries;
    }

    private static function isFresh(?array $entry): bool
    {
        if (!$entry) {
            return false;
        }

        $window = $entry['quote'] === null
            ? ($entry['unknown_for'] ?? self::UNKNOWN_FRESH_SECONDS)
            : self::FRESH_SECONDS;

        return now()->getTimestamp() - $entry['fetched_at'] < $window;
    }

    private static function key(string $id): string
    {
        return "price:v1:{$id}";
    }

    private static function startCooldown(\Throwable $e): void
    {
        $retryAfter = $e instanceof RequestException ? (int) $e->response->header('Retry-After') : 0;

        $cooldown = $retryAfter > 0 ? min($retryAfter, 300) : self::DEFAULT_COOLDOWN_SECONDS;

        Cache::put(self::COOLDOWN_KEY, true, now()->addSeconds($cooldown));

        Log::warning('Price fetch failed, pausing price requests', [
            'cooldown_seconds' => $cooldown,
            'message' => $e->getMessage(),
        ]);
    }
}
