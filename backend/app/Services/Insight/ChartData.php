<?php

namespace App\Services\Insight;

use App\Support\CoinGecko;
use App\Support\StaleCache;

/**
 * Candles and volume for the price chart and its analysis, in USD like the rest
 * of the API. Times are Unix seconds, which is what the chart library plots.
 */
class ChartData
{
    // The timeframes that can be analyzed, => CoinGecko `days`. On the free
    // tier that gives 30-minute candles for 1 day and 4-hour candles for 7 and
    // 30; `interval` is paid only.
    public const TIMEFRAMES = ['1d' => 1, '7d' => 7, '30d' => 30];

    // Longer ranges are chart only. CoinGecko's free OHLC gives 4-day candles
    // for 365 days. For 90 days it also only has 4-day candles (about 23, too
    // coarse to read), so daily candles are built from the hourly prices
    // `market_chart` returns for that range.
    public const CHART_ONLY_TIMEFRAMES = ['90d' => 90, '1y' => 365];

    private const BUILT_CANDLE_SECONDS = ['90d' => 86_400];

    // 4-hour candles need 30 days of history for EMA50 and RSI, at the same
    // size. 30D's own 180 candles already give it that.
    private const ANALYSIS_DAYS = ['1d' => 1, '7d' => 30, '30d' => 30];

    // Older than this, an analysis would describe a market that has moved on.
    private const MAX_ANALYSIS_DATA_AGE_SECONDS = 1_800;

    // A month's levels move slowly, so the copy they're read from can be older.
    private const MAX_HIGHER_TIMEFRAME_AGE_SECONDS = 21_600;

    public static function chartKey(string $coinId, string $timeframe): string
    {
        return "insight_chart_{$coinId}_{$timeframe}";
    }

    public static function historyKey(string $coinId, string $timeframe): string
    {
        return "insight_history_{$coinId}_{$timeframe}";
    }

    /** Every range the chart can show, analysis or not. */
    public static function chartTimeframes(): array
    {
        return [...self::TIMEFRAMES, ...self::CHART_ONLY_TIMEFRAMES];
    }

    /** Long ranges barely move, so they're refreshed less often. */
    public static function chartFreshSeconds(string $timeframe): int
    {
        return array_key_exists($timeframe, self::CHART_ONLY_TIMEFRAMES)
            ? (int) config('insight.long_chart_fresh_seconds')
            : (int) config('insight.chart_fresh_seconds');
    }

    public static function chart(string $coinId, string $timeframe): array
    {
        if (array_key_exists($timeframe, self::CHART_ONLY_TIMEFRAMES)) {
            return [
                'coinId' => $coinId,
                'timeframe' => $timeframe,
                'analysisAllowed' => false,
                ...self::fetchChartOnly($coinId, $timeframe),
            ];
        }

        $days = self::ANALYSIS_DAYS[$timeframe];
        $data = self::fetch($coinId, $days);

        if ($days !== self::TIMEFRAMES[$timeframe]) {
            // CoinGecko gives 4-hour candles for 7 and for 30 days, so one fetch
            // serves both. Keeping the full history means an Analyze click
            // doesn't wait on two more CoinGecko calls while a visitor waits.
            StaleCache::put(self::historyKey($coinId, $timeframe), $data);
            $data = self::visible($data, (int) config("insight.analysis.{$timeframe}.visible_seconds"));
        }

        return [
            'coinId' => $coinId,
            'timeframe' => $timeframe,
            'analysisAllowed' => array_key_exists($coinId, config('insight.allowed_coins')),
            ...$data,
        ];
    }

    /**
     * Data for an analysis, or null if nothing recent enough can be had.
     *
     * @return array{candles: array, volume: array, price: ?float}|null
     */
    public static function history(string $coinId, string $timeframe): ?array
    {
        $fresh = (int) config('insight.chart_fresh_seconds');
        $days = self::ANALYSIS_DAYS[$timeframe];

        // Both are usually cached by the chart that is already on screen.
        [$key, $fetch] = $days === self::TIMEFRAMES[$timeframe]
            ? [self::chartKey($coinId, $timeframe), fn () => self::chart($coinId, $timeframe)]
            : [self::historyKey($coinId, $timeframe), fn () => self::fetch($coinId, $days)];

        $data = StaleCache::remember($key, $fresh, $fetch);
        $entry = StaleCache::peek($key);

        if (!$data || !$entry || now()->getTimestamp() - $entry['fetched_at'] > self::MAX_ANALYSIS_DATA_AGE_SECONDS) {
            return null;
        }

        return $data;
    }

    /**
     * The month of 4-hour candles that 30D levels come from, for checking 1D
     * levels against. The 30D chart and 7D's history are the same data, and 7D
     * is the chart every coin page opens on, so a copy is nearly always cached.
     * Levels this long barely move, so an older copy is fine.
     *
     * @param  bool  $mayFetch  false when the visitor's request has no time to wait on CoinGecko
     */
    public static function monthCandles(string $coinId, bool $mayFetch): ?array
    {
        foreach ([self::chartKey($coinId, '30d'), self::historyKey($coinId, '7d')] as $key) {
            $entry = StaleCache::peek($key);

            if ($entry && now()->getTimestamp() - $entry['fetched_at'] <= self::MAX_HIGHER_TIMEFRAME_AGE_SECONDS) {
                return $entry['data']['candles'] ?? null;
            }
        }

        if (!$mayFetch) {
            return null;
        }

        $data = StaleCache::remember(self::chartKey($coinId, '30d'), self::chartFreshSeconds('30d'), fn () => self::chart($coinId, '30d'));

        return $data['candles'] ?? null;
    }

    /**
     * @return array{candles: array, volume: array<int, array{time: int, value: float}>, price: ?float}
     */
    private static function fetch(string $coinId, int $days): array
    {
        $candles = self::candles(CoinGecko::get("/coins/{$coinId}/ohlc", [
            'vs_currency' => 'usd',
            'days' => $days,
        ], timeout: 15));

        // The OHLC endpoint has no volume, so it takes a second call.
        $chart = CoinGecko::get("/coins/{$coinId}/market_chart", [
            'vs_currency' => 'usd',
            'days' => $days,
        ], timeout: 15);

        $prices = (array) ($chart['prices'] ?? []);
        $latest = end($prices);

        return [
            'candles' => $candles,
            'volume' => self::volumeAtCandles($candles, (array) ($chart['total_volumes'] ?? [])),
            // Fresher than the last candle's close, which can be hours old.
            'price' => is_array($latest) && is_numeric($latest[1] ?? null) ? (float) $latest[1] : null,
        ];
    }

    /**
     * @return array{candles: array, volume: array, price: ?float}
     */
    private static function fetchChartOnly(string $coinId, string $timeframe): array
    {
        $days = self::CHART_ONLY_TIMEFRAMES[$timeframe];
        $bucket = self::BUILT_CANDLE_SECONDS[$timeframe] ?? null;

        if ($bucket === null) {
            return self::fetch($coinId, $days);
        }

        // One call: the hourly prices become the candles and carry the volume.
        $chart = CoinGecko::get("/coins/{$coinId}/market_chart", [
            'vs_currency' => 'usd',
            'days' => $days,
        ], timeout: 15);

        $prices = (array) ($chart['prices'] ?? []);
        $candles = self::candlesFromPrices($prices, $bucket);
        $latest = end($prices);

        return [
            'candles' => $candles,
            'volume' => self::volumeAtCandles($candles, (array) ($chart['total_volumes'] ?? [])),
            'price' => is_array($latest) && is_numeric($latest[1] ?? null) ? (float) $latest[1] : null,
        ];
    }

    /**
     * Groups price samples into fixed UTC buckets. Each candle is stamped with
     * its close time, like CoinGecko's own, so the forming one sits at the end
     * and the live price updates it instead of adding another.
     *
     * @param  array<int, mixed>  $points  [timeMs, price]
     * @return array<int, array{time: int, open: float, high: float, low: float, close: float}>
     */
    public static function candlesFromPrices(array $points, int $bucketSeconds): array
    {
        $samples = [];

        foreach ($points as $point) {
            if (is_array($point) && is_numeric($point[0] ?? null) && is_numeric($point[1] ?? null)) {
                $samples[(int) ($point[0] / 1000)] = (float) $point[1];
            }
        }

        ksort($samples);

        $buckets = [];

        foreach ($samples as $time => $price) {
            $close = intdiv($time, $bucketSeconds) * $bucketSeconds + $bucketSeconds;
            $candle = $buckets[$close] ?? null;

            $buckets[$close] = $candle === null
                ? ['time' => $close, 'open' => $price, 'high' => $price, 'low' => $price, 'close' => $price]
                : [...$candle, 'high' => max($candle['high'], $price), 'low' => min($candle['low'], $price), 'close' => $price];
        }

        if (count($buckets) < 2) {
            throw new \UnexpectedValueException('Invalid price data.');
        }

        return array_values($buckets);
    }

    /**
     * The newest stretch of a longer history. Uses the same cut-off as the
     * analysis lines (TechnicalAnalysis::visibleLine), so they start on the
     * same candle as the chart.
     *
     * @param  array{candles: array, volume: array, price: ?float}  $data
     */
    private static function visible(array $data, int $seconds): array
    {
        $from = end($data['candles'])['time'] - $seconds;
        $keep = fn (array $point) => $point['time'] >= $from;

        return [
            ...$data,
            'candles' => array_values(array_filter($data['candles'], $keep)),
            'volume' => array_values(array_filter($data['volume'], $keep)),
        ];
    }

    /**
     * Drops malformed rows and orders by time. The chart library throws on
     * repeated or out-of-order times, so one bad row would lose the whole chart.
     *
     * @param  array<int, mixed>  $rows  [closeTimeMs, open, high, low, close]
     * @return array<int, array{time: int, open: float, high: float, low: float, close: float}>
     */
    public static function candles(array $rows): array
    {
        $byTime = [];

        foreach ($rows as $row) {
            if (!is_array($row) || count($row) < 5) {
                continue;
            }

            [$timeMs, $open, $high, $low, $close] = $row;

            if (!is_numeric($timeMs) || !is_numeric($open) || !is_numeric($high) || !is_numeric($low) || !is_numeric($close)) {
                continue;
            }

            $time = (int) ($timeMs / 1000);

            $byTime[$time] = [
                'time' => $time,
                'open' => (float) $open,
                'high' => (float) $high,
                'low' => (float) $low,
                'close' => (float) $close,
            ];
        }

        ksort($byTime);

        if (count($byTime) < 2) {
            throw new \UnexpectedValueException('Invalid candle data.');
        }

        return array_values($byTime);
    }

    /**
     * The two endpoints use different time steps, so each candle takes the
     * latest volume known when it closed. Candles older than the first volume
     * reading get no bar rather than a made-up one.
     *
     * @param  array<int, array{time: int}>  $candles
     * @param  array<int, mixed>  $points  [timeMs, volume]
     * @return array<int, array{time: int, value: float}>
     */
    public static function volumeAtCandles(array $candles, array $points): array
    {
        $readings = [];

        foreach ($points as $point) {
            if (is_array($point) && is_numeric($point[0] ?? null) && is_numeric($point[1] ?? null)) {
                $readings[(int) ($point[0] / 1000)] = (float) $point[1];
            }
        }

        ksort($readings);

        $times = array_keys($readings);
        $count = count($times);
        $next = 0;
        $latest = null;
        $volume = [];

        foreach ($candles as $candle) {
            while ($next < $count && $times[$next] <= $candle['time']) {
                $latest = $readings[$times[$next]];
                $next++;
            }

            if ($latest !== null) {
                $volume[] = ['time' => $candle['time'], 'value' => $latest];
            }
        }

        return $volume;
    }
}
