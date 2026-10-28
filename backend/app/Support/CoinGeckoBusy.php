<?php

namespace App\Support;

/**
 * Thrown instead of calling CoinGecko when we know the call would be
 * rate limited, so callers fall back to cached data immediately.
 */
class CoinGeckoBusy extends \RuntimeException
{
    public function __construct(public readonly int $retryAfter, string $message)
    {
        parent::__construct($message);
    }
}
