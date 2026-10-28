<?php

namespace App\Support;

use Illuminate\Http\Client\RequestException;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * Stale-while-revalidate cache for upstream API data.
 *
 * - Fresh entry: served straight from cache.
 * - Expired entry: one request refreshes it (guarded by a lock); everyone
 *   else keeps getting the last good data instead of hitting CoinGecko.
 * - Upstream failure: last good data is served and upstream is left alone
 *   for a cooldown period (honouring Retry-After on 429s).
 * - Only when nothing has ever been cached does the endpoint return 503.
 */
class StaleCache
{
    // How long the last good copy is kept as a fallback.
    private const KEEP_FOR_DAYS = 7;

    private const DEFAULT_COOLDOWN_SECONDS = 60;

    /**
     * @param  callable|null  $fallback  Builds a substitute entry (or null)
     *   when nothing is cached for this key and upstream is unavailable.
     */
    public static function respond(string $key, int $freshSeconds, callable $fetch, ?callable $fallback = null): JsonResponse
    {
        $entryKey = "swr:{$key}";
        $cooldownKey = "swr:{$key}:cooldown";

        $entry = Cache::get($entryKey);

        if (self::isFresh($entry, $freshSeconds)) {
            return self::hit($entry, 'cache', false);
        }

        if ($entry && Cache::has($cooldownKey)) {
            return self::hit($entry, 'stale-cache', true);
        }

        $lock = Cache::lock("swr:{$key}:lock", 20);

        if (!$lock->get()) {
            if ($entry) {
                // Someone else is already refreshing; don't pile on.
                return self::hit($entry, 'stale-cache', true);
            }

            // Cold cache: wait briefly for the in-flight refresh to land.
            try {
                $lock->block(15);
                $lock->release();
            } catch (\Throwable) {
                // Timed out waiting, fall through to whatever is cached.
            }

            $entry = Cache::get($entryKey);

            return $entry
                ? self::hit($entry, 'cache', false)
                : self::fallbackOrUnavailable($fallback);
        }

        try {
            $fresh = self::refresh($key, $fetch);
        } catch (RequestException) {
            // refresh() only lets upstream 404s through.
            return response()->json([
                'success' => false,
                'error' => 'Not found.',
            ], 404);
        } finally {
            $lock->release();
        }

        if ($fresh) {
            return self::hit($fresh, 'upstream', false);
        }

        return $entry
            ? self::hit($entry, 'stale-cache', true)
            : self::fallbackOrUnavailable($fallback);
    }

    /**
     * The last stored entry for a key, fresh or not.
     */
    public static function peek(string $key): ?array
    {
        $entry = Cache::get("swr:{$key}");

        return is_array($entry) ? $entry : null;
    }

    /**
     * Refresh an entry shortly before it expires so user requests keep
     * hitting fresh cache. Used by the `market:warm` scheduled command.
     */
    public static function warm(string $key, int $freshSeconds, callable $fetch, int $marginSeconds = 60): string
    {
        $entry = Cache::get("swr:{$key}");

        if (self::isFresh($entry, $freshSeconds - $marginSeconds)) {
            return 'fresh';
        }

        if (Cache::has("swr:{$key}:cooldown")) {
            return 'cooldown';
        }

        $lock = Cache::lock("swr:{$key}:lock", 20);

        if (!$lock->get()) {
            return 'locked';
        }

        try {
            return self::refresh($key, $fetch) ? 'refreshed' : 'failed';
        } catch (RequestException) {
            return 'failed';
        } finally {
            $lock->release();
        }
    }

    /**
     * Fetch upstream and store the result. Returns the new entry, or null on
     * failure (after starting a cooldown). Upstream 404s are rethrown.
     */
    private static function refresh(string $key, callable $fetch): ?array
    {
        $cooldownKey = "swr:{$key}:cooldown";

        try {
            $entry = [
                'data' => $fetch(),
                'cached_at' => now()->toISOString(),
                'fetched_at' => now()->getTimestamp(),
            ];

            Cache::put("swr:{$key}", $entry, now()->addDays(self::KEEP_FOR_DAYS));
            Cache::forget($cooldownKey);

            return $entry;
        } catch (RequestException $e) {
            if ($e->response->status() === 404) {
                throw $e;
            }

            self::recordFailure($key, $cooldownKey, $e, (int) $e->response->header('Retry-After'));
        } catch (CoinGeckoBusy) {
            // CoinGecko tracks its own block, so no per-key cooldown is needed.
        } catch (\Throwable $e) {
            self::recordFailure($key, $cooldownKey, $e);
        }

        return null;
    }

    private static function isFresh(mixed $entry, int $freshSeconds): bool
    {
        return is_array($entry)
            && isset($entry['fetched_at'])
            && now()->getTimestamp() - $entry['fetched_at'] < $freshSeconds;
    }

    private static function recordFailure(string $key, string $cooldownKey, \Throwable $e, int $retryAfter = 0): void
    {
        $cooldown = $retryAfter > 0
            ? min($retryAfter, 300)
            : self::DEFAULT_COOLDOWN_SECONDS;

        Cache::put($cooldownKey, true, now()->addSeconds($cooldown));

        Log::warning('Upstream fetch failed, pausing requests to it', [
            'key' => $key,
            'cooldown_seconds' => $cooldown,
            'message' => $e->getMessage(),
        ]);
    }

    private static function hit(array $entry, string $source, bool $stale): JsonResponse
    {
        $response = response()->json([
            'success' => true,
            'source' => $source,
            'stale' => $stale,
            'cached_at' => $entry['cached_at'],
            'data' => $entry['data'],
        ]);

        // Let browsers reuse the response briefly and revalidate cheaply:
        // an unchanged entry answers If-None-Match with an empty 304.
        $response->setEtag(md5($entry['cached_at']));
        $response->setCache([
            'public' => true,
            'max_age' => 15,
            'stale_while_revalidate' => 60,
        ]);
        $response->isNotModified(request());

        return $response;
    }

    private static function fallbackOrUnavailable(?callable $fallback): JsonResponse
    {
        $entry = $fallback ? $fallback() : null;

        return $entry
            ? self::hit($entry, 'derived-cache', true)
            : self::unavailable();
    }

    private static function unavailable(): JsonResponse
    {
        return response()->json([
            'success' => false,
            'error' => 'Data temporarily unavailable. Please try again shortly.',
        ], 503, ['Retry-After' => 30]);
    }
}
