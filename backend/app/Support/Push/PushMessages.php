<?php

namespace App\Support\Push;

use App\Models\PriceAlert;

/**
 * The wording of every alert. Calm and factual on purpose: no "CRASH", no
 * "to the moon", and never a call to trade, since panic wording pushes people
 * into bad trades.
 */
class PushMessages
{
    private const SYMBOLS = [
        'usd' => '$', 'php' => '₱', 'eur' => '€', 'gbp' => '£', 'jpy' => '¥',
        'cny' => '¥', 'krw' => '₩', 'inr' => '₹', 'aud' => 'A$', 'cad' => 'C$',
        'sgd' => 'S$', 'hkd' => 'HK$', 'nzd' => 'NZ$', 'thb' => '฿', 'vnd' => '₫',
    ];

    /**
     * @param  array<int, array{0: PriceAlert, 1: float}>  $hits  each alert with the price that hit it
     * @return array{title: string, body: string, url: string}
     */
    public static function priceAlerts(array $hits): array
    {
        if (count($hits) === 1) {
            [$alert, $price] = $hits[0];

            return [
                'title' => self::alertText($alert, 'is'),
                'body' => 'Now ' . self::money($price, $alert->currency) . '.',
                'url' => '/coin/' . rawurlencode($alert->coin_id),
            ];
        }

        // Several at once read better as one message than as a burst.
        return [
            'title' => count($hits) . ' of your price alerts were hit',
            'body' => implode(' · ', array_map(fn (array $hit) => self::alertText($hit[0]), $hits)),
            'url' => '/alerts',
        ];
    }

    /**
     * @param  array{kind: string, pct: float}  $move  the move that set it off: market cap over 24h, or BTC over 4h
     * @return array{title: string, body: string, url: string}
     */
    public static function market(array $move, ?float $market24h, ?float $btc24h, ?float $eth24h): array
    {
        $direction = $move['pct'] < 0 ? 'down' : 'up';
        $size = number_format(abs($move['pct']), 1);

        if ($move['kind'] === 'btc') {
            $title = "BTC {$direction} {$size}% in 4 hours";
            $details = array_filter([
                $market24h === null ? null : 'Crypto market ' . self::pct($market24h) . ' in 24h',
                $eth24h === null ? null : 'ETH ' . self::pct($eth24h),
            ]);
        } else {
            $title = "Crypto market {$direction} {$size}% in 24h";
            $details = array_filter([
                $btc24h === null ? null : 'BTC ' . self::pct($btc24h),
                $eth24h === null ? null : 'ETH ' . self::pct($eth24h),
            ]);
        }

        return [
            'title' => $title,
            'body' => $details === [] ? 'See the market overview.' : implode(', ', $details) . '.',
            'url' => '/',
        ];
    }

    /**
     * @param  array{bullish: int, bearish: int, neutral: int, label: string}|null  $sentiment
     * @return array{title: string, body: string, url: string}
     */
    public static function brief(?float $market24h, ?array $sentiment, int $bigStories): array
    {
        $parts = array_filter([
            $market24h === null ? null : 'Market ' . self::pct($market24h) . ' in 24h',
            $sentiment === null ? null : self::sentimentText($sentiment),
            match ($bigStories) {
                0 => 'no big stories today',
                1 => '1 big story today',
                default => "{$bigStories} big stories today",
            },
        ]);

        return [
            'title' => 'Your daily crypto brief',
            'body' => ucfirst(implode(' · ', $parts)) . '.',
            'url' => '/news',
        ];
    }

    public static function money(float $value, string $currency): string
    {
        $symbol = self::SYMBOLS[$currency] ?? strtoupper($currency) . ' ';

        // Small coins need their significant digits; large ones don't need cents.
        $formatted = match (true) {
            abs($value) >= 1_000 => number_format($value, 0),
            abs($value) >= 1 => number_format($value, 2),
            $value == 0 => '0',
            default => rtrim(rtrim(sprintf('%.' . max(2, 3 - (int) floor(log10(abs($value)))) . 'f', $value), '0'), '.'),
        };

        return $symbol . $formatted;
    }

    public static function pct(float $value): string
    {
        return ($value >= 0 ? '+' : '-') . number_format(abs($value), 1) . '%';
    }

    private static function alertText(PriceAlert $alert, ?string $verb = null): string
    {
        return implode(' ', array_filter([
            strtoupper($alert->coin_symbol),
            $verb,
            $alert->direction,
            self::money($alert->threshold, $alert->currency),
        ]));
    }

    private static function sentimentText(array $sentiment): string
    {
        return match ($sentiment['label']) {
            'bullish' => "sentiment {$sentiment['bullish']}% bullish",
            'bearish' => "sentiment {$sentiment['bearish']}% bearish",
            default => "sentiment mostly neutral ({$sentiment['neutral']}%)",
        };
    }
}
