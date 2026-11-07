import { describe, expect, it } from 'vitest';
import {
  chartMinMove,
  chartUrlPath,
  parseChartResponse,
  summarizeSeries,
  withLivePrice,
} from '@/lib/chartSeries';
import type { CandleSeries, LineSeries } from '@/types/chart';

const candles: CandleSeries = {
  kind: 'candles',
  analysisAllowed: true,
  candles: [
    { time: 1_000, open: 100, high: 110, low: 95, close: 105 },
    { time: 2_000, open: 105, high: 120, low: 100, close: 110 },
  ],
  volume: [{ time: 1_000, value: 500 }, { time: 2_000, value: 600 }],
};

const line: LineSeries = {
  kind: 'line',
  line: [{ time: 1_000, value: 100 }, { time: 2_000, value: 150 }],
  volume: [{ time: 2_000, value: 700 }],
};

const atSeconds = (seconds: number) => new Date(seconds * 1_000).toISOString();

describe('chartUrlPath', () => {
  it('uses candles for every range', () => {
    expect(chartUrlPath('bitcoin', '1d')).toBe('/api/coins/bitcoin/chart?tf=1d');
    expect(chartUrlPath('bitcoin', '7d')).toBe('/api/coins/bitcoin/chart?tf=7d');
    expect(chartUrlPath('bitcoin', '30d')).toBe('/api/coins/bitcoin/chart?tf=30d');
    expect(chartUrlPath('bitcoin', '90d')).toBe('/api/coins/bitcoin/chart?tf=90d');
    expect(chartUrlPath('bitcoin', '1y')).toBe('/api/coins/bitcoin/chart?tf=1y');
  });

  it('escapes the coin id', () => {
    expect(chartUrlPath('a/b', '1d')).toBe('/api/coins/a%2Fb/chart?tf=1d');
  });
});

describe('parseChartResponse', () => {
  it('reads candles', () => {
    const series = parseChartResponse({ candles: candles.candles, volume: candles.volume, analysisAllowed: true });

    expect(series.kind).toBe('candles');
  });

  it('turns line pairs into seconds', () => {
    expect(parseChartResponse({ prices: [[1_000_000, 5]], total_volumes: [[1_000_000, 9]] })).toEqual({
      kind: 'line',
      line: [{ time: 1_000, value: 5 }],
      volume: [{ time: 1_000, value: 9 }],
    });
  });

  it('keeps times unique and ascending, which the chart library requires', () => {
    const series = parseChartResponse({
      prices: [[3_000, 3], [1_000, 1], [1_500, 2], [2_000, Number.NaN]],
    });

    expect(series).toMatchObject({ line: [{ time: 1, value: 2 }, { time: 3, value: 3 }], volume: [] });
  });
});

describe('withLivePrice', () => {
  it('moves the last candle when the price is from inside it', () => {
    const result = withLivePrice(candles, 125, atSeconds(1_500)) as CandleSeries;

    expect(result.candles).toHaveLength(2);
    expect(result.candles[1]).toEqual({ time: 2_000, open: 105, high: 125, low: 100, close: 125 });
  });

  it('starts a new candle from the last close when the price is newer', () => {
    const result = withLivePrice(candles, 108, atSeconds(3_000)) as CandleSeries;

    expect(result.candles[2]).toEqual({ time: 3_000, open: 110, high: 110, low: 108, close: 108 });
  });

  it('moves or extends a line the same way', () => {
    expect((withLivePrice(line, 200, atSeconds(1_500)) as LineSeries).line[1]).toEqual({ time: 2_000, value: 200 });
    expect((withLivePrice(line, 200, atSeconds(3_000)) as LineSeries).line[2]).toEqual({ time: 3_000, value: 200 });
  });

  it('leaves the series alone without a usable live price', () => {
    expect(withLivePrice(candles, null, atSeconds(3_000))).toBe(candles);
    expect(withLivePrice(candles, 5, null)).toBe(candles);
    expect(withLivePrice(candles, 5, 'not a date')).toBe(candles);
    expect(withLivePrice(candles, Number.NaN, atSeconds(3_000))).toBe(candles);
  });

  it('copes with no history', () => {
    const empty: LineSeries = { kind: 'line', line: [], volume: [] };

    expect(withLivePrice(empty, 5, atSeconds(3_000))).toBe(empty);
  });
});

describe('summarizeSeries', () => {
  it('uses wicks for the range and the first open for the change', () => {
    expect(summarizeSeries(candles)).toEqual({
      first: 100,
      last: 110,
      low: 95,
      high: 120,
      changePct: 10,
      latestVolume: 600,
    });
  });

  it('summarizes a line', () => {
    expect(summarizeSeries(line)).toEqual({
      first: 100,
      last: 150,
      low: 100,
      high: 150,
      changePct: 50,
      latestVolume: 700,
    });
  });

  it('needs two points to say anything', () => {
    expect(summarizeSeries({ ...line, line: [line.line[0]] })).toBeNull();
    expect(summarizeSeries({ ...candles, candles: [candles.candles[0]] })).toBeNull();
  });

  it('has no volume when none was sent', () => {
    expect(summarizeSeries({ ...line, volume: [] })?.latestVolume).toBeNull();
  });

  it('does not divide by a zero start', () => {
    expect(summarizeSeries({ ...line, line: [{ time: 1, value: 0 }, { time: 2, value: 5 }] })?.changePct).toBe(0);
  });
});

describe('chartMinMove', () => {
  it('stays at a cent for ordinary prices', () => {
    expect(chartMinMove(76_000)).toBe(0.01);
    expect(chartMinMove(11.7)).toBe(0.01);
  });

  it('shrinks with tiny prices so they keep their detail', () => {
    expect(chartMinMove(0.31)).toBeCloseTo(0.0001);
    expect(chartMinMove(0.00000473)).toBeCloseTo(1e-9, 12);
  });

  it('has a safe default', () => {
    expect(chartMinMove(0)).toBe(0.01);
    expect(chartMinMove(Number.NaN)).toBe(0.01);
  });
});
