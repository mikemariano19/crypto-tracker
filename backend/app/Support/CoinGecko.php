<?php

namespace App\Support;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\RateLimiter;

class CoinGecko
{
    private const BASE_URL = 'https://api.coingecko.com/api/v3';

    // CoinGecko rate limits per IP, so one 429 blocks every endpoint.
    private const BLOCKED_UNTIL_KEY = 'coingecko:blocked-until';

    private const CALL_BUDGET_KEY = 'coingecko:calls';

    /**
     * GET a CoinGecko endpoint and return the decoded JSON.
     *
     * Network blips are retried. A 429, or our own per-minute call budget
     * running out, throws CoinGeckoBusy without touching the network until
     * the block lifts; other HTTP errors throw a RequestException.
     */
    public static function get(string $path, array $query = [], int $timeout = 10): array
    {
        self::reserveCall();

        try {
            $data = self::client($timeout)
                ->get(self::BASE_URL . $path, $query)
                ->throw()
                ->json();
        } catch (RequestException $e) {
            if ($e->response->status() === 429) {
                $retryAfter = min(max((int) $e->response->header('Retry-After'), 30), 300);

                Cache::put(self::BLOCKED_UNTIL_KEY, now()->getTimestamp() + $retryAfter, $retryAfter);

                throw new CoinGeckoBusy($retryAfter, "CoinGecko rate limited {$path}");
            }

            throw $e;
        }

        if (!is_array($data) || empty($data)) {
            throw new \UnexpectedValueException("Empty or invalid response from CoinGecko {$path}");
        }

        return $data;
    }

    private static function reserveCall(): void
    {
        $blockedFor = (int) Cache::get(self::BLOCKED_UNTIL_KEY, 0) - now()->getTimestamp();

        if ($blockedFor > 0) {
            throw new CoinGeckoBusy($blockedFor, 'CoinGecko is rate limiting this server');
        }

        $budget = (int) config('services.coingecko.calls_per_minute');

        if (RateLimiter::tooManyAttempts(self::CALL_BUDGET_KEY, $budget)) {
            throw new CoinGeckoBusy(
                RateLimiter::availableIn(self::CALL_BUDGET_KEY),
                'CoinGecko call budget used up for this minute'
            );
        }

        RateLimiter::hit(self::CALL_BUDGET_KEY, 60);
    }

    private static function client(int $timeout): PendingRequest
    {
        $client = Http::acceptJson()
            ->timeout($timeout)
            ->retry(2, 300, fn ($e) => $e instanceof ConnectionException);

        $apiKey = config('services.coingecko.key');

        return $apiKey
            ? $client->withHeaders(['x-cg-demo-api-key' => $apiKey])
            : $client;
    }
}
