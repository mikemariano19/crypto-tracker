<?php

namespace App\Services\Insight;

/**
 * The numbers behind a price insight: support/resistance zones, moving
 * averages, RSI, volume and trend. Pure functions with no I/O, so the same
 * candles always give the same levels. The AI explains these and never
 * supplies its own.
 */
class TechnicalAnalysis
{
    public const RSI_OVERBOUGHT = 70;

    public const RSI_OVERSOLD = 30;

    private const MAX_ZONES_PER_SIDE = 2;

    private const ATR_PERIOD = 14;

    // A zone is at least this share of the average candle range wide, so a
    // volatile coin's normal wiggle doesn't read as a break of the level.
    private const ZONE_ATR_SHARE = 0.5;

    private const STRENGTH_STEP_UP = ['weak' => 'moderate', 'moderate' => 'strong', 'strong' => 'strong'];

    // A touch this far into the data counts as recent.
    private const RECENT_FROM_SHARE = 2 / 3;

    private const MODERATE_SCORE = 3;

    private const STRONG_SCORE = 4;

    // CoinGecko's volume is a rolling 24h total, which moves slowly, so even a
    // modest gap from its average is a real change.
    private const VOLUME_HIGH_PCT = 20;

    private const VOLUME_LOW_PCT = -20;

    // Without a slow average, the fast one's direction over this many candles
    // separates a trend from price just sitting on the wrong side of it.
    private const SLOPE_CANDLES = 5;

    /**
     * @param  array<int, array{time: int, open: float, high: float, low: float, close: float}>  $candles  oldest first
     * @param  array<int, array{time: int, value: float}>  $volume  oldest first
     * @param  array{visible_seconds: int, swing_window: int, zone_width_pct: float, ema_fast: int, ema_slow: ?int, rsi_period: int, volume_period: int}  $settings
     * @param  ?float  $currentPrice  the live price. A long candle's close can be hours old, which would put zones on the wrong side of the price.
     */
    public static function analyze(array $candles, array $volume, array $settings, ?float $currentPrice = null): array
    {
        if ($candles === []) {
            throw new \InvalidArgumentException('No candles to analyze.');
        }

        $last = $candles[count($candles) - 1];
        $price = $currentPrice ?? $last['close'];
        $closes = array_column($candles, 'close');
        $times = array_column($candles, 'time');
        $visibleFrom = $last['time'] - $settings['visible_seconds'];

        $fast = self::ema($closes, $settings['ema_fast']);
        $slow = $settings['ema_slow'] === null ? [] : self::ema($closes, $settings['ema_slow']);
        $rsi = self::rsi($closes, $settings['rsi_period']);

        $rsiLatest = self::lastValue($rsi);

        return [
            'price' => $price,
            'zones' => self::zones($candles, $price, $settings['swing_window'], $settings['zone_width_pct'], self::atr($candles, self::ATR_PERIOD)),
            'ema20' => self::visibleLine($times, $fast, $visibleFrom),
            'ema50' => self::visibleLine($times, $slow, $visibleFrom),
            'rsi' => self::visibleLine($times, $rsi, $visibleFrom),
            'rsiLatest' => $rsiLatest,
            'rsiState' => $rsiLatest === null ? null : self::rsiState($rsiLatest),
            'volume' => self::volumeStats(array_column($volume, 'value'), $settings['volume_period']),
            'trend' => self::trend(
                $price,
                self::lastValue($fast),
                self::lastValue($slow),
                self::lastValue($fast, self::SLOPE_CANDLES),
            ),
        ];
    }

    /**
     * Candles whose high (or low) is the extreme of the $window candles on each
     * side. The newest $window candles can't qualify until they have a right
     * side. Equal neighbours count once, at the first of them, so a flat top
     * isn't scored as several touches.
     *
     * @return array<int, array{type: string, price: float, index: int}>
     */
    public static function swingPoints(array $candles, int $window): array
    {
        $swings = [];
        $count = count($candles);

        for ($i = $window; $i < $count - $window; $i++) {
            $isHigh = true;
            $isLow = true;

            for ($offset = 1; $offset <= $window; $offset++) {
                $isHigh = $isHigh
                    && $candles[$i]['high'] > $candles[$i - $offset]['high']
                    && $candles[$i]['high'] >= $candles[$i + $offset]['high'];

                $isLow = $isLow
                    && $candles[$i]['low'] < $candles[$i - $offset]['low']
                    && $candles[$i]['low'] <= $candles[$i + $offset]['low'];
            }

            if ($isHigh) {
                $swings[] = ['type' => 'high', 'price' => $candles[$i]['high'], 'index' => $i];
            }

            if ($isLow) {
                $swings[] = ['type' => 'low', 'price' => $candles[$i]['low'], 'index' => $i];
            }
        }

        return $swings;
    }

    /**
     * Groups swing points by price. Every point in a group is within $widthPct
     * of the group's lowest, so a slow drift of prices can't chain into one
     * huge zone. Highs and lows mix: old resistance often becomes support.
     *
     * @param  array<int, array{price: float, index: int}>  $swings
     * @return array<int, array<int, array{price: float, index: int}>>
     */
    public static function clusterSwings(array $swings, float $widthPct): array
    {
        usort($swings, fn (array $a, array $b) => $a['price'] <=> $b['price']);

        $clusters = [];

        foreach ($swings as $swing) {
            $current = count($clusters) - 1;

            if ($current >= 0 && $swing['price'] <= $clusters[$current][0]['price'] * (1 + $widthPct / 100)) {
                $clusters[$current][] = $swing;
            } else {
                $clusters[] = [$swing];
            }
        }

        return $clusters;
    }

    /**
     * Times the level held, plus one if it was last tested in the newest third
     * of the data. The first break is the usual role flip (old resistance
     * becoming support); every break after it means the level isn't holding.
     */
    public static function zoneStrength(int $rejections, int $latestIndex, int $candleCount, int $breaks = 0): string
    {
        $isRecent = $latestIndex >= $candleCount * self::RECENT_FROM_SHARE;
        $score = $rejections + ($isRecent ? 1 : 0) - max(0, $breaks - 1);

        return match (true) {
            $score >= self::STRONG_SCORE => 'strong',
            $score >= self::MODERATE_SCORE => 'moderate',
            default => 'weak',
        };
    }

    /**
     * At most two zones on each side of the price, named R1/R2 and S1/S2,
     * closest first. Distance is measured to the zone's middle.
     *
     * Swing points say where a level is; every candle that reached it after
     * that says how well it held. The zone is never narrower than half the
     * average candle range ($atr), so a fixed width can't make a volatile
     * coin's levels look broken by ordinary noise.
     *
     * @return array<int, array{id: string, type: string, from: float, to: float, distancePct: float, strength: string, touches: int, rejections: int, breaks: int, testing: bool}>
     */
    public static function zones(array $candles, float $price, int $window, float $widthPct, ?float $atr = null): array
    {
        if ($price <= 0) {
            return [];
        }

        if ($atr !== null && $atr > 0) {
            $widthPct = max($widthPct, self::ZONE_ATR_SHARE * $atr / $price * 100);
        }

        $swings = array_values(array_filter(
            self::swingPoints($candles, $window),
            fn (array $swing) => $swing['price'] > 0,
        ));

        $zones = array_map(
            fn (array $cluster) => self::buildZone($cluster, $candles, $price, $widthPct),
            self::clusterSwings($swings, $widthPct),
        );

        return self::pickAndName($zones);
    }

    /**
     * Checks a short timeframe's levels against a longer one's, the way a
     * trader marks the bigger levels first. A level both agree on is one step
     * stronger. A longer-timeframe level is added when it's closer than what
     * the short one found, or fills a side it left short, since price may be
     * about to meet it even if the short chart can't see it yet.
     *
     * @param  array<int, array>  $zones  from zones() on the short timeframe
     * @param  array<int, array>  $higher  from zones() on the long one, at the same price
     * @return array<int, array> the zones, each with `source` (the timeframe it was found on) and `confluence`
     */
    public static function withHigherTimeframe(array $zones, array $higher, string $timeframe, string $higherTimeframe): array
    {
        $overlaps = fn (array $a, array $b) => $a['from'] <= $b['to'] && $b['from'] <= $a['to'];
        $unmatched = $higher;
        $candidates = [];

        foreach ($zones as $zone) {
            $agrees = array_filter($higher, fn (array $other) => $overlaps($zone, $other)) !== [];

            $candidates[] = [
                ...$zone,
                // Agreeing with the bigger picture adds evidence; it doesn't replace it.
                'strength' => $agrees ? self::STRENGTH_STEP_UP[$zone['strength']] : $zone['strength'],
                'source' => $timeframe,
                'confluence' => $agrees,
            ];

            $unmatched = array_filter($unmatched, fn (array $other) => !$overlaps($zone, $other));
        }

        foreach (['resistance', 'support'] as $type) {
            $own = array_filter($zones, fn (array $zone) => $zone['type'] === $type);
            $reach = count($own) >= self::MAX_ZONES_PER_SIDE ? max(array_map(fn (array $zone) => abs($zone['distancePct']), $own)) : INF;

            foreach ($unmatched as $zone) {
                if ($zone['type'] === $type && abs($zone['distancePct']) < $reach) {
                    $candidates[] = [...$zone, 'source' => $higherTimeframe, 'confluence' => false];
                }
            }
        }

        return self::pickAndName($candidates);
    }

    /**
     * Up to two zones a side, closest first, named R1/R2 and S1/S2.
     */
    private static function pickAndName(array $zones): array
    {
        $zones = array_map(function (array $zone) {
            unset($zone['id']);

            return $zone;
        }, $zones);

        usort($zones, fn (array $a, array $b) => abs($a['distancePct']) <=> abs($b['distancePct']));

        $picked = [];

        foreach (['resistance' => 'R', 'support' => 'S'] as $type => $prefix) {
            $side = self::pickSide(array_values(array_filter($zones, fn (array $zone) => $zone['type'] === $type)));

            foreach ($side as $i => $zone) {
                $picked[] = ['id' => $prefix . ($i + 1), ...$zone];
            }
        }

        return $picked;
    }

    /**
     * Levels with more evidence beat ones that are merely closer: a single
     * touch only fills a slot nothing better took. A zone the price is in is
     * always relevant. Overlapping zones would be the same level twice.
     *
     * @param  array<int, array>  $side  closest first
     */
    private static function pickSide(array $side): array
    {
        $picked = [];
        $isEligible = [
            fn (array $zone) => $zone['strength'] !== 'weak' || $zone['testing'],
            fn (array $zone) => $zone['strength'] === 'weak' && !$zone['testing'],
        ];

        foreach ($isEligible as $eligible) {
            foreach ($side as $zone) {
                if (count($picked) >= self::MAX_ZONES_PER_SIDE) {
                    break 2;
                }

                $overlaps = array_filter($picked, fn (array $other) => $zone['from'] <= $other['to'] && $other['from'] <= $zone['to']);

                if ($eligible($zone) && $overlaps === []) {
                    $picked[] = $zone;
                }
            }
        }

        usort($picked, fn (array $a, array $b) => abs($a['distancePct']) <=> abs($b['distancePct']));

        return $picked;
    }

    private static function buildZone(array $cluster, array $candles, float $price, float $widthPct): array
    {
        $prices = array_column($cluster, 'price');
        $middle = (min($prices) + max($prices)) / 2;

        // Clustering keeps a group's own spread under the width, so every zone
        // comes out this wide, centered on its swings. A level is never exact.
        $from = $middle * (1 - $widthPct / 200);
        $to = $middle * (1 + $widthPct / 200);
        $tests = self::zoneTests($candles, $from, $to);

        return [
            // A zone the price is inside still gets a side, from its middle.
            'type' => $middle > $price ? 'resistance' : 'support',
            'from' => $from,
            'to' => $to,
            'distancePct' => round(($middle - $price) / $price * 100, 2),
            'strength' => self::zoneStrength($tests['rejections'], $tests['latestIndex'], count($candles), $tests['breaks']),
            'touches' => $tests['touches'],
            'rejections' => $tests['rejections'],
            'breaks' => $tests['breaks'],
            'testing' => $price >= $from && $price <= $to,
        ];
    }

    /**
     * Each run of candles that reached into the zone is one test. It held if
     * price left on the side it came from, and broke if it left on the other.
     * A test still going on, or one at the very start of the data, is a touch
     * with no verdict yet.
     *
     * @return array{touches: int, rejections: int, breaks: int, latestIndex: int}
     */
    public static function zoneTests(array $candles, float $from, float $to): array
    {
        $result = ['touches' => 0, 'rejections' => 0, 'breaks' => 0, 'latestIndex' => 0];
        $count = count($candles);
        $side = fn (array $candle) => $candle['close'] > $to ? 1 : -1;
        $i = 0;

        while ($i < $count) {
            if ($candles[$i]['high'] < $from || $candles[$i]['low'] > $to) {
                $i++;

                continue;
            }

            $start = $i;

            while ($i < $count && $candles[$i]['high'] >= $from && $candles[$i]['low'] <= $to) {
                $i++;
            }

            $result['touches']++;
            $result['latestIndex'] = $start;

            // Candles outside the zone are wholly above or below it.
            if ($start > 0 && $i < $count) {
                $side($candles[$start - 1]) === $side($candles[$i])
                    ? $result['rejections']++
                    : $result['breaks']++;
            }
        }

        return $result;
    }

    /**
     * The zones a timeframe's own analysis would show, for checking a shorter
     * timeframe against.
     *
     * @param  array{swing_window: int, zone_width_pct: float}  $settings
     */
    public static function levelsFor(array $candles, float $price, array $settings): array
    {
        return self::zones($candles, $price, $settings['swing_window'], $settings['zone_width_pct'], self::atr($candles));
    }

    /**
     * Average true range with Wilder's smoothing: the typical size of one
     * candle, gaps included. Null with too few candles.
     */
    public static function atr(array $candles, int $period = self::ATR_PERIOD): ?float
    {
        $count = count($candles);

        if ($count <= $period) {
            return null;
        }

        $ranges = [];

        for ($i = 1; $i < $count; $i++) {
            $previousClose = $candles[$i - 1]['close'];
            $ranges[] = max(
                $candles[$i]['high'] - $candles[$i]['low'],
                abs($candles[$i]['high'] - $previousClose),
                abs($candles[$i]['low'] - $previousClose),
            );
        }

        $atr = array_sum(array_slice($ranges, 0, $period)) / $period;

        foreach (array_slice($ranges, $period) as $range) {
            $atr = ($atr * ($period - 1) + $range) / $period;
        }

        return $atr;
    }

    /**
     * Exponential moving average, seeded with the simple average of the first
     * $period values. Keys match $values; earlier positions have no entry.
     *
     * @param  array<int, float>  $values
     * @return array<int, float>
     */
    public static function ema(array $values, int $period): array
    {
        $count = count($values);

        if ($count < $period) {
            return [];
        }

        $multiplier = 2 / ($period + 1);
        $ema = array_sum(array_slice($values, 0, $period)) / $period;
        $result = [$period - 1 => $ema];

        for ($i = $period; $i < $count; $i++) {
            $ema = ($values[$i] - $ema) * $multiplier + $ema;
            $result[$i] = $ema;
        }

        return $result;
    }

    /**
     * RSI with Wilder's smoothing. Keys match $closes; earlier positions have
     * no entry.
     *
     * @param  array<int, float>  $closes
     * @return array<int, float>
     */
    public static function rsi(array $closes, int $period = 14): array
    {
        $count = count($closes);

        if ($count <= $period) {
            return [];
        }

        $gain = 0.0;
        $loss = 0.0;

        for ($i = 1; $i <= $period; $i++) {
            $change = $closes[$i] - $closes[$i - 1];
            $gain += max($change, 0);
            $loss += max(-$change, 0);
        }

        $gain /= $period;
        $loss /= $period;
        $result = [$period => self::rsiFrom($gain, $loss)];

        for ($i = $period + 1; $i < $count; $i++) {
            $change = $closes[$i] - $closes[$i - 1];
            $gain = ($gain * ($period - 1) + max($change, 0)) / $period;
            $loss = ($loss * ($period - 1) + max(-$change, 0)) / $period;
            $result[$i] = self::rsiFrom($gain, $loss);
        }

        return $result;
    }

    private static function rsiFrom(float $gain, float $loss): float
    {
        // Not moving at all is neutral, not "fully overbought".
        if ($gain == 0 && $loss == 0) {
            return 50.0;
        }

        return round(100 * $gain / ($gain + $loss), 2);
    }

    public static function rsiState(float $rsi): string
    {
        return match (true) {
            $rsi >= self::RSI_OVERBOUGHT => 'overbought',
            $rsi <= self::RSI_OVERSOLD => 'oversold',
            default => 'neutral',
        };
    }

    /**
     * The latest volume against the average of the $period readings before it.
     * Null when there isn't enough volume data to compare.
     *
     * @param  array<int, float>  $values
     * @return array{vsAvgPct: float, label: string}|null
     */
    public static function volumeStats(array $values, int $period = 20): ?array
    {
        $count = count($values);

        if ($count <= $period) {
            return null;
        }

        $average = array_sum(array_slice($values, $count - $period - 1, $period)) / $period;

        if ($average <= 0) {
            return null;
        }

        $vsAvgPct = round(($values[$count - 1] - $average) / $average * 100, 1);

        return [
            'vsAvgPct' => $vsAvgPct,
            'label' => match (true) {
                $vsAvgPct >= self::VOLUME_HIGH_PCT => 'high',
                $vsAvgPct <= self::VOLUME_LOW_PCT => 'low',
                default => 'normal',
            },
        ];
    }

    /**
     * With two averages: price above fast above slow is up, the reverse is
     * down. With only the fast one: price on one side and the average moving
     * the same way. Anything else, or too little data, is sideways.
     */
    public static function trend(float $price, ?float $fast, ?float $slow, ?float $fastEarlier = null): string
    {
        if ($fast === null) {
            return 'sideways';
        }

        if ($slow !== null) {
            return match (true) {
                $price > $fast && $fast > $slow => 'up',
                $price < $fast && $fast < $slow => 'down',
                default => 'sideways',
            };
        }

        if ($fastEarlier === null) {
            return 'sideways';
        }

        return match (true) {
            $price > $fast && $fast > $fastEarlier => 'up',
            $price < $fast && $fast < $fastEarlier => 'down',
            default => 'sideways',
        };
    }

    /**
     * @param  array<int, int>  $times  candle times by position
     * @param  array<int, float>  $series  values keyed by the same positions
     * @return array<int, array{time: int, value: float}>
     */
    private static function visibleLine(array $times, array $series, int $visibleFrom): array
    {
        $line = [];

        foreach ($series as $position => $value) {
            if ($times[$position] >= $visibleFrom) {
                $line[] = ['time' => $times[$position], 'value' => $value];
            }
        }

        return $line;
    }

    /**
     * The value $back entries before the newest, or null if the series is too
     * short.
     */
    private static function lastValue(array $series, int $back = 0): ?float
    {
        return array_values($series)[count($series) - 1 - $back] ?? null;
    }
}
