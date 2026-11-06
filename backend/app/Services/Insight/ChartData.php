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
    // Timeframe => CoinGecko `days`. On the free tier that gives 30-minute
    // candles for 1 day and 4-hour candles for 7; `interval` is paid only.
    public const TIMEFRAMES = ['1d' => 1, '7d' => 7];

    // 4-hour candles need 30 days of history for EMA50 and RSI, at the same size.
    private const ANALYSIS_DAYS = ['1d' => 1, '7d' => 30];

    // Older than this, an analysis would describe a market that has moved on.
    private const MAX_ANALYSIS_DATA_AGE_SECONDS = 1_800;

    public static function chartKey(string $coinId, string $timeframe): string
    {
        return "insight_chart_{$coinId}_{$timeframe}";
    }

    public static function historyKey(string $coinId, string $timeframe): string
    {
        return "insight_history_{$coinId}_{$timeframe}";
    }

    public static function chart(string $coinId, string $timeframe): array
    {
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
