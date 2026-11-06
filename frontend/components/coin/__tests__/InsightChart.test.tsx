// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import InsightChart from '@/components/coin/InsightChart';
import type { ChartSeries } from '@/types/chart';
import type { PriceInsight } from '@/types/insight';

// A stand-in for the library that, like the real one, throws once the chart
// is gone. Any other call just returns another stand-in.
const state = vi.hoisted(() => ({
  removed: false,
  lateCalls: [] as string[],
  onRemoveSeries: null as null | (() => void),
}));

vi.mock('lightweight-charts', () => {
  const AFTER_REMOVE = new Set(['removeSeries', 'detachPrimitive', 'detach', 'removePriceLine']);

  const fake = (): unknown =>
    new Proxy(function () {}, {
      get: (_target, name) => {
        if (name === 'then') return undefined;
        if (name === 'panes') return () => [fake(), fake()];
        if (name === 'remove') return () => { state.removed = true; };
        if (typeof name === 'string' && AFTER_REMOVE.has(name)) {
          return () => {
            if (name === 'removeSeries') state.onRemoveSeries?.();
            if (state.removed) {
              state.lateCalls.push(name);
              throw new Error('Value is undefined');
            }
          };
        }
        return fake();
      },
      apply: () => fake(),
    });

  return {
    createChart: () => fake(),
    createSeriesMarkers: () => fake(),
    CandlestickSeries: {},
    AreaSeries: {},
    HistogramSeries: {},
    LineSeries: {},
    ColorType: { Solid: 'solid' },
    LineStyle: { Dashed: 2 },
    CrosshairMode: { Normal: 0 },
    TrackingModeExitMode: { OnTouchEnd: 0 },
  };
});

vi.mock('@/components/coin/zonesPrimitive', () => ({ ZonesPrimitive: class { setOpacity() {} } }));

const series: ChartSeries = {
  kind: 'candles',
  candles: [
    { time: 1_000, open: 100, high: 110, low: 90, close: 105 },
    { time: 2_000, open: 105, high: 120, low: 100, close: 110 },
  ],
  volume: [{ time: 2_000, value: 5_000 }],
  analysisAllowed: true,
};

const insight = {
  coinId: 'bitcoin',
  timeframe: '7d',
  price: 110,
  zones: [{ id: 'R1', type: 'resistance', from: 118, to: 122, distancePct: 9, strength: 'strong', touches: 3, testing: false }],
  ema20: [{ time: 1_000, value: 100 }, { time: 2_000, value: 104 }],
  ema50: [{ time: 2_000, value: 101 }],
  rsi: [{ time: 2_000, value: 56 }],
  rsiLatest: 56,
  rsiState: 'neutral',
  volume: { vsAvgPct: 18, label: 'normal' },
  trend: 'up',
  newsPins: [{ time: 2_000, headline: 'SEC approves a product', source: 'Test News', url: 'https://news.test/a', label: 'bullish' }],
  ai: null,
  aiStatus: 'unavailable',
  accuracy: null,
  analyzedAt: '2026-11-06T12:00:00Z',
  expiresAt: '2026-11-06T18:00:00Z',
} as PriceInsight;

beforeEach(() => {
  state.removed = false;
  state.lateCalls = [];
  state.onRemoveSeries = null;
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
  // jsdom has no canvas; theme colors fall back to a plain grey.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it('turning the analysis off still removes its lines from the chart', () => {
  const props = { series, range: '7d' as const, money: { code: 'usd', rate: 1 }, isUp: true, label: 'chart' };
  const toggles = { ma: true, rsi: true, volume: true, sr: true };
  const { rerender } = render(<InsightChart {...props} insight={insight} toggles={toggles} />);

  // Same chart, analysis cleared: the guard must not skip this cleanup.
  state.removed = false;
  const removeSpy = vi.fn();
  state.onRemoveSeries = removeSpy;
  rerender(<InsightChart {...props} insight={null} toggles={toggles} />);

  expect(removeSpy).toHaveBeenCalled();
});

it('leaving the page with an analysis on screen does not touch the removed chart', () => {
  const { unmount } = render(
    <InsightChart
      series={series}
      range="7d"
      money={{ code: 'usd', rate: 1 }}
      isUp
      label="chart"
      insight={insight}
      toggles={{ ma: true, rsi: true, volume: true, sr: true }}
    />,
  );

  // Navigating away unmounts the chart. This used to throw, and Next showed
  // "This page couldn't load" instead of the next page.
  expect(() => unmount()).not.toThrow();
  expect(state.removed).toBe(true);
  expect(state.lateCalls).toEqual([]);
});
