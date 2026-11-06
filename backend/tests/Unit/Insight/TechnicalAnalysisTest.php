<?php

namespace Tests\Unit\Insight;

use App\Services\Insight\TechnicalAnalysis as TA;
use PHPUnit\Framework\TestCase;

class TechnicalAnalysisTest extends TestCase
{
    private const SETTINGS = [
        'visible_seconds' => 1_000,
        'swing_window' => 1,
        'zone_width_pct' => 1.0,
        'ema_fast' => 3,
        'ema_slow' => 5,
        'rsi_period' => 3,
        'volume_period' => 3,
    ];

    /**
     * Candles from [high, low] pairs; close sits midway unless given.
     */
    private function candles(array $highLows): array
    {
        return array_map(fn (array $pair, int $i) => [
            'time' => 1_000 + $i * 100,
            'open' => ($pair[0] + $pair[1]) / 2,
            'high' => (float) $pair[0],
            'low' => (float) $pair[1],
            'close' => (float) ($pair[2] ?? ($pair[0] + $pair[1]) / 2),
        ], $highLows, array_keys($highLows));
    }

    private function fromCloses(array $closes): array
    {
        return $this->candles(array_map(fn ($close) => [$close, $close, $close], $closes));
    }

    // ---- Swing points ----

    public function test_finds_swing_highs_and_lows(): void
    {
        $swings = TA::swingPoints($this->candles([[10, 8], [12, 9], [10, 7], [11, 8], [10, 8]]), 1);

        $this->assertSame([
            ['type' => 'high', 'price' => 12.0, 'index' => 1],
            ['type' => 'low', 'price' => 7.0, 'index' => 2],
            ['type' => 'high', 'price' => 11.0, 'index' => 3],
        ], $swings);
    }

    public function test_swing_must_beat_every_candle_in_the_window(): void
    {
        $candles = $this->candles([[10, 9], [11, 9], [12, 9], [13, 9], [12, 9], [14, 9], [12, 9], [11, 9], [10, 9]]);

        $highs = fn (int $window) => array_column(
            array_filter(TA::swingPoints($candles, $window), fn ($swing) => $swing['type'] === 'high'),
            'index',
        );

        $this->assertSame([3, 5], $highs(1));
        // With a wider window, 13 no longer qualifies: 14 is within reach.
        $this->assertSame([5], $highs(2));
    }

    public function test_newest_candles_cannot_be_swings_yet(): void
    {
        $swings = TA::swingPoints($this->candles([[10, 9], [11, 9], [12, 9], [13, 9]]), 1);

        $this->assertSame([], $swings);
    }

    public function test_flat_top_counts_once(): void
    {
        $swings = TA::swingPoints($this->candles([[10, 9], [12, 9], [12, 9], [10, 9]]), 1);

        $this->assertSame([['type' => 'high', 'price' => 12.0, 'index' => 1]], $swings);
    }

    // ---- Clustering ----

    public function test_clusters_prices_within_the_width(): void
    {
        $clusters = TA::clusterSwings([
            ['price' => 100.0, 'index' => 0],
            ['price' => 110.0, 'index' => 1],
            ['price' => 100.9, 'index' => 2],
        ], 1.0);

        $this->assertCount(2, $clusters);
        $this->assertSame([100.0, 100.9], array_column($clusters[0], 'price'));
        $this->assertSame([110.0], array_column($clusters[1], 'price'));
    }

    public function test_slow_drift_does_not_chain_into_one_zone(): void
    {
        $clusters = TA::clusterSwings([
            ['price' => 100.0, 'index' => 0],
            ['price' => 100.8, 'index' => 1],
            ['price' => 101.6, 'index' => 2],
        ], 1.0);

        // Each is within 1% of the last, but the ends are not.
        $this->assertCount(2, $clusters);
    }

    // ---- Strength ----

    public function test_strength_comes_from_touches_and_recency(): void
    {
        // Latest touch at index 10 of 90 is old; at index 80 is recent.
        $this->assertSame('weak', TA::zoneStrength(1, 10, 90));
        $this->assertSame('weak', TA::zoneStrength(1, 80, 90));
        $this->assertSame('weak', TA::zoneStrength(2, 10, 90));
        $this->assertSame('moderate', TA::zoneStrength(2, 80, 90));
        $this->assertSame('moderate', TA::zoneStrength(3, 10, 90));
        $this->assertSame('strong', TA::zoneStrength(3, 80, 90));
        $this->assertSame('strong', TA::zoneStrength(4, 10, 90));
    }

    // ---- Zones ----

    public function test_zones_are_classified_named_and_closest_first(): void
    {
        $candles = $this->candles([
            [90, 89], [95, 94], [90, 80], [90, 89],
            [110, 89], [90, 89], [120, 89], [90, 89],
            [90, 70], [90, 89], [130, 89], [90, 89],
            [90, 60], [90, 89], [100, 99, 100],
        ]);

        $zones = TA::zones($candles, 100.0, 1, 1.0);

        $this->assertSame(['R1', 'R2', 'S1', 'S2'], array_column($zones, 'id'));
        $this->assertSame(['resistance', 'resistance', 'support', 'support'], array_column($zones, 'type'));

        // R1 is 110, not 120 or 130; S1 is 95, not 80 or lower.
        $this->assertEqualsWithDelta(110.0, ($zones[0]['from'] + $zones[0]['to']) / 2, 0.001);
        $this->assertEqualsWithDelta(120.0, ($zones[1]['from'] + $zones[1]['to']) / 2, 0.001);
        $this->assertEqualsWithDelta(95.0, ($zones[2]['from'] + $zones[2]['to']) / 2, 0.001);
        $this->assertEqualsWithDelta(80.0, ($zones[3]['from'] + $zones[3]['to']) / 2, 0.001);
    }

    public function test_distance_is_signed_and_measured_to_the_middle(): void
    {
        $zones = TA::zones($this->candles([[90, 89], [110, 89], [90, 89], [90, 80], [90, 89]]), 100.0, 1, 1.0);

        $byId = array_column($zones, null, 'id');

        $this->assertSame(10.0, $byId['R1']['distancePct']);
        $this->assertSame(-20.0, $byId['S1']['distancePct']);
    }

    public function test_single_touch_gets_the_minimum_width(): void
    {
        $zones = TA::zones($this->candles([[90, 89], [110, 89], [90, 89]]), 100.0, 1, 1.0);

        $this->assertEqualsWithDelta(109.45, $zones[0]['from'], 0.001);
        $this->assertEqualsWithDelta(110.55, $zones[0]['to'], 0.001);
        $this->assertSame(1, $zones[0]['touches']);
    }

    public function test_zone_holding_the_price_is_marked_as_testing(): void
    {
        $zones = TA::zones($this->candles([[90, 89], [100.2, 89], [90, 89]]), 100.0, 1, 1.0);

        $this->assertTrue($zones[0]['testing']);
        $this->assertSame('resistance', $zones[0]['type']);
    }

    public function test_touches_are_counted_across_the_cluster(): void
    {
        $zones = TA::zones($this->candles([[90, 89], [110, 89], [90, 89], [110.5, 89], [90, 89]]), 100.0, 1, 1.0);

        $this->assertCount(1, array_filter($zones, fn ($zone) => $zone['type'] === 'resistance'));
        $this->assertSame(2, $zones[0]['touches']);

        // The zone covers both touches.
        $this->assertLessThanOrEqual(110.0, $zones[0]['from']);
        $this->assertGreaterThanOrEqual(110.5, $zones[0]['to']);
    }

    public function test_no_swings_means_no_zones(): void
    {
        $this->assertSame([], TA::zones($this->candles([[10, 9], [11, 10], [12, 11]]), 12.0, 1, 1.0));
    }

    public function test_tiny_prices_keep_their_precision(): void
    {
        $zones = TA::zones($this->candles([[0.000004, 0.000003], [0.000005, 0.000003], [0.000004, 0.000003]]), 0.000004, 1, 1.0);

        $this->assertEqualsWithDelta(0.000005, ($zones[0]['from'] + $zones[0]['to']) / 2, 0.0000001);
        $this->assertSame(25.0, $zones[0]['distancePct']);
    }

    // ---- EMA ----

    public function test_ema_matches_the_published_reference(): void
    {
        // StockCharts' worked 10-day EMA example.
        $closes = [
            22.27, 22.19, 22.08, 22.17, 22.18, 22.13, 22.23, 22.43, 22.24, 22.29,
            22.15, 22.39, 22.38, 22.61, 23.36, 24.05, 23.75, 23.83, 23.95, 23.63,
            23.82, 23.87, 23.65, 23.19, 23.10, 23.33, 22.68, 23.10, 22.40, 22.17,
        ];

        $expected = [
            9 => 22.22, 10 => 22.21, 11 => 22.24, 12 => 22.27, 13 => 22.33, 14 => 22.52,
            15 => 22.80, 16 => 22.97, 17 => 23.13, 18 => 23.28, 19 => 23.34, 20 => 23.43,
            21 => 23.51, 22 => 23.54, 23 => 23.47, 24 => 23.40, 25 => 23.39, 26 => 23.26,
            27 => 23.23, 28 => 23.08, 29 => 22.92,
        ];

        $ema = TA::ema($closes, 10);

        $this->assertSame(array_keys($expected), array_keys($ema));

        foreach ($expected as $i => $value) {
            $this->assertEqualsWithDelta($value, $ema[$i], 0.01, "EMA at position {$i}");
        }
    }

    public function test_ema_needs_a_full_period(): void
    {
        $this->assertSame([], TA::ema([1.0, 2.0], 3));
    }

    // ---- RSI ----

    public function test_rsi_matches_the_published_reference(): void
    {
        // StockCharts' worked 14-period RSI example (Wilder's smoothing).
        $closes = [
            44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84, 46.08,
            45.89, 46.03, 45.61, 46.28, 46.28, 46.00, 46.03, 46.41, 46.22, 45.64,
            46.21, 46.25, 45.71, 46.45, 45.78, 45.35, 44.03, 44.18, 44.22, 44.57,
            43.42, 42.66, 43.13,
        ];

        $expected = [
            14 => 70.53, 15 => 66.32, 16 => 66.55, 17 => 69.41, 18 => 66.36, 19 => 57.97,
            20 => 62.93, 21 => 63.26, 22 => 56.06, 23 => 62.38, 24 => 54.71, 25 => 50.42,
            26 => 39.99, 27 => 41.46, 28 => 41.87, 29 => 45.46, 30 => 37.30, 31 => 33.08,
            32 => 37.77,
        ];

        $rsi = TA::rsi($closes, 14);

        $this->assertSame(array_keys($expected), array_keys($rsi));

        foreach ($expected as $i => $value) {
            // The published table used unrounded closes.
            $this->assertEqualsWithDelta($value, $rsi[$i], 0.3, "RSI at position {$i}");
        }
    }

    public function test_rsi_edges(): void
    {
        $this->assertSame([], TA::rsi([1.0, 2.0, 3.0], 3));
        $this->assertSame(100.0, TA::rsi([1.0, 2.0, 3.0, 4.0], 3)[3]);
        $this->assertSame(0.0, TA::rsi([4.0, 3.0, 2.0, 1.0], 3)[3]);
        $this->assertSame(50.0, TA::rsi([5.0, 5.0, 5.0, 5.0], 3)[3]);
    }

    public function test_rsi_states_include_their_boundaries(): void
    {
        $this->assertSame('overbought', TA::rsiState(70));
        $this->assertSame('neutral', TA::rsiState(69.99));
        $this->assertSame('neutral', TA::rsiState(30.01));
        $this->assertSame('oversold', TA::rsiState(30));
    }

    // ---- Volume ----

    public function test_volume_compares_the_latest_to_the_readings_before_it(): void
    {
        // Average of the three before the last is 100; the oldest is ignored.
        $this->assertSame(
            ['vsAvgPct' => 18.0, 'label' => 'normal'],
            TA::volumeStats([9999.0, 100.0, 100.0, 100.0, 118.0], 3),
        );
    }

    public function test_volume_labels(): void
    {
        $this->assertSame('high', TA::volumeStats([100.0, 100.0, 100.0, 120.0], 3)['label']);
        $this->assertSame('low', TA::volumeStats([100.0, 100.0, 100.0, 80.0], 3)['label']);
        $this->assertSame('normal', TA::volumeStats([100.0, 100.0, 100.0, 81.0], 3)['label']);
    }

    public function test_volume_without_enough_data_is_null(): void
    {
        $this->assertNull(TA::volumeStats([], 3));
        $this->assertNull(TA::volumeStats([1.0, 2.0, 3.0], 3));
        $this->assertNull(TA::volumeStats([0.0, 0.0, 0.0, 5.0], 3));
    }

    // ---- Trend ----

    public function test_trend_with_both_averages(): void
    {
        $this->assertSame('up', TA::trend(110, 105, 100));
        $this->assertSame('down', TA::trend(90, 95, 100));
        $this->assertSame('sideways', TA::trend(103, 105, 100));
        $this->assertSame('sideways', TA::trend(97, 95, 100));
    }

    public function test_trend_with_only_the_fast_average_uses_its_direction(): void
    {
        $this->assertSame('up', TA::trend(110, 105, null, 100));
        $this->assertSame('down', TA::trend(90, 95, null, 100));
        // Price on one side but the average heading the other way.
        $this->assertSame('sideways', TA::trend(110, 105, null, 108));
        $this->assertSame('sideways', TA::trend(90, 95, null, 92));
    }

    public function test_trend_without_enough_data_is_sideways(): void
    {
        $this->assertSame('sideways', TA::trend(100, null, null));
        $this->assertSame('sideways', TA::trend(100, 95, null, null));
    }

    // ---- Whole analysis ----

    public function test_analysis_uses_the_last_close_and_clips_lines_to_the_window(): void
    {
        $candles = $this->fromCloses(range(100, 129));
        $volume = array_map(fn ($candle) => ['time' => $candle['time'], 'value' => 100.0], $candles);

        // 300 seconds back from the last candle is the last four candles.
        $result = TA::analyze($candles, $volume, ['visible_seconds' => 300] + self::SETTINGS);

        $this->assertSame(129.0, $result['price']);
        $this->assertCount(4, $result['ema20']);
        $this->assertCount(4, $result['ema50']);
        $this->assertCount(4, $result['rsi']);
        $this->assertSame($candles[29]['time'], $result['ema20'][3]['time']);
        $this->assertSame(100.0, $result['rsiLatest']);
        $this->assertSame('overbought', $result['rsiState']);
        $this->assertSame('up', $result['trend']);
        $this->assertSame(['vsAvgPct' => 0.0, 'label' => 'normal'], $result['volume']);
    }

    public function test_live_price_decides_which_side_a_zone_is_on(): void
    {
        // The last close is 100, under the swing high at 110.
        $candles = $this->candles([[90, 89], [110, 89], [90, 89], [100, 100, 100]]);

        $fromClose = TA::analyze($candles, [], self::SETTINGS);
        $this->assertSame(100.0, $fromClose['price']);
        $this->assertSame('resistance', $fromClose['zones'][0]['type']);

        // By now the market has moved above it, though the candle hasn't closed.
        $live = TA::analyze($candles, [], self::SETTINGS, 115.0);
        $this->assertSame(115.0, $live['price']);
        $this->assertSame('support', $live['zones'][0]['type']);
    }

    public function test_latest_rsi_is_the_newest_value_of_the_series(): void
    {
        // Ups and downs, so each position has a different RSI.
        $closes = [100.0, 104.0, 101.0, 106.0, 103.0, 102.0, 107.0, 100.0, 103.0, 99.0];
        $expected = TA::rsi($closes, 3);

        $result = TA::analyze($this->fromCloses($closes), [], self::SETTINGS);

        $this->assertSame($expected[9], $result['rsiLatest']);
        $this->assertNotSame($expected[6], $result['rsiLatest']);
    }

    public function test_analysis_without_a_slow_average_leaves_that_line_empty(): void
    {
        $result = TA::analyze($this->fromCloses(range(100, 129)), [], ['ema_slow' => null] + self::SETTINGS);

        $this->assertSame([], $result['ema50']);
        $this->assertNotSame([], $result['ema20']);
        $this->assertSame('up', $result['trend']);
    }

    public function test_analysis_survives_too_little_data(): void
    {
        $result = TA::analyze($this->fromCloses([100.0, 101.0]), [], self::SETTINGS);

        $this->assertSame([], $result['ema20']);
        $this->assertSame([], $result['rsi']);
        $this->assertNull($result['rsiLatest']);
        $this->assertNull($result['rsiState']);
        $this->assertNull($result['volume']);
        $this->assertSame('sideways', $result['trend']);
        $this->assertSame([], $result['zones']);
    }

    public function test_analysis_rejects_no_candles(): void
    {
        $this->expectException(\InvalidArgumentException::class);

        TA::analyze([], [], self::SETTINGS);
    }

    public function test_same_candles_always_give_the_same_result(): void
    {
        $candles = $this->candles([[90, 89], [110, 89], [90, 80], [105, 89], [90, 89], [91, 89]]);

        $this->assertSame(TA::analyze($candles, [], self::SETTINGS), TA::analyze($candles, [], self::SETTINGS));
    }
}
