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
     * Big moves and level breaks on the subscriber's own coins. Several coins
     * at once become one message.
     *
     * @param  array<int, array{coin: string, symbol: string, price: float, currency: string, kind: string, pct?: float, direction?: string, from?: float, to?: float}>  $hits  prices in `currency`, zone edges in USD
     * @param  float  $rate  `currency` per USD, for the zone edges
     * @return array{title: string, body: string, url: string}
     */
    public static function coinMoves(array $hits, float $rate): array
    {
        $byCoin = [];

        foreach ($hits as $hit) {
            $byCoin[$hit['coin']][$hit['kind']] = $hit;
        }

        if (count($byCoin) === 1) {
            $coin = array_key_first($byCoin);
            $move = $byCoin[$coin]['move'] ?? null;
            $level = $byCoin[$coin]['level'] ?? null;
            $any = $move ?? $level;
            $now = 'Now ' . self::money($any['price'], $any['currency']);

            if ($move) {
                $title = "{$move['symbol']} " . ($move['pct'] < 0 ? 'down' : 'up') . ' ' . number_format(abs($move['pct']), 1) . '% in 4 hours';
                $body = $level
                    ? "{$now}. It also moved " . self::zoneText($level, $rate) . '.'
                    : "{$now}.";
            } else {
                $title = "{$level['symbol']} broke " . ($level['direction'] === 'up' ? 'above resistance' : 'below support');
                $body = "{$now}, " . self::zoneText($level, $rate) . '.';
            }

            return ['title' => $title, 'body' => $body, 'url' => '/coin/' . rawurlencode($coin)];
        }

        $moves = array_filter($hits, fn (array $hit) => $hit['kind'] === 'move');
        $directions = array_unique(array_map(fn (array $hit) => $hit['pct'] < 0 ? 'down' : 'up', $moves));
        $count = count($byCoin);

        $title = count($moves) === count($hits) && count($directions) === 1
            ? "{$count} of your coins are {$directions[array_key_first($directions)]} "
                . rtrim(rtrim(number_format((float) config('push.moves.pct_4h'), 1), '0'), '.') . '%+ in 4 hours'
            : "{$count} of your coins made big moves";

        $parts = array_map(fn (array $hit) => $hit['kind'] === 'move'
            ? "{$hit['symbol']} " . self::pct($hit['pct'])
            : "{$hit['symbol']} " . ($hit['direction'] === 'up' ? 'above resistance' : 'below support'), $hits);

        return ['title' => $title, 'body' => implode(' · ', $parts), 'url' => '/alerts'];
    }

    /**
     * High-impact stories and a mood shift from the news pipeline, as one
     * message.
     *
     * @param  array<int, array{id: string, title: string, label: ?string, summary: ?string}>  $stories  most important first
     * @param  array{from: string, to: string, pct: int}|null  $mood
     * @return array{title: string, body: string, url: string}
     */
    public static function news(array $stories, ?array $mood): array
    {
        $moodText = $mood === null ? null : 'Market sentiment shifted from ' . ucfirst($mood['from'])
            . ' to ' . ucfirst($mood['to']) . " ({$mood['pct']}% {$mood['to']})";

        if ($stories === []) {
            return ['title' => $moodText, 'body' => 'Based on the latest analyzed news.', 'url' => '/news'];
        }

        if (count($stories) === 1) {
            $story = $stories[0];
            $lead = $story['label'] && $story['label'] !== 'neutral' ? ucfirst($story['label']) . ', high impact' : 'High impact';
            $body = array_filter([$story['summary'] ? self::clip($story['summary'], 200) : null, $moodText ? "{$moodText}." : null]);

            return [
                'title' => self::clip("{$lead}: {$story['title']}", 120),
                'body' => $body === [] ? 'Tap to read the story.' : implode(' ', $body),
                'url' => '/news#story-' . rawurlencode($story['id']),
            ];
        }

        $body = implode(' · ', array_map(fn (array $story) => self::clip($story['title'], 90), array_slice($stories, 0, 3)));

        return [
            'title' => count($stories) . ' high-impact crypto stories',
            'body' => self::clip($body . ($moodText ? ". {$moodText}." : ''), 400),
            'url' => '/news',
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

    /** "above the 7D resistance zone at $69,000–$69,800", in the subscriber's currency. */
    private static function zoneText(array $level, float $rate): string
    {
        $range = self::money($level['from'] * $rate, $level['currency']) . '–' . self::money($level['to'] * $rate, $level['currency']);

        return $level['direction'] === 'up'
            ? "above the 7D resistance zone at {$range}"
            : "below the 7D support zone at {$range}";
    }

    private static function clip(string $text, int $length): string
    {
        $text = trim($text);

        return mb_strlen($text) <= $length ? $text : rtrim(mb_substr($text, 0, $length - 1)) . '…';
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
