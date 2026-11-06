import type {
  Candle,
  CandleChartResponse,
  ChartRange,
  ChartSeries,
  ChartSummary,
  LineChartResponse,
  LinePoint,
} from '@/types/chart';

const MS_PER_SECOND = 1_000;

const LINE_RANGE_DAYS: Partial<Record<ChartRange, number>> = { '30d': 30, '90d': 90, '1y': 365 };

/**
 * 1D and 7D come as real candles. CoinGecko's free tier only has 4-day candles
 * past 30 days, too coarse to read, so longer ranges are a line.
 */
export function chartUrlPath(coinId: string, range: ChartRange): string {
  const id = encodeURIComponent(coinId);
  const days = LINE_RANGE_DAYS[range];

  return days ? `/api/coin/${id}/chart?days=${days}` : `/api/coins/${id}/chart?tf=${range}`;
}

function pointsFromPairs(pairs: [number, number][] | undefined): LinePoint[] {
  const byTime = new Map<number, number>();

  for (const [timeMs, value] of pairs ?? []) {
    if (Number.isFinite(timeMs) && Number.isFinite(value)) {
      byTime.set(Math.floor(timeMs / MS_PER_SECOND), value);
    }
  }

  // The chart library throws on repeated or out-of-order times.
  return [...byTime.entries()]
    .sort(([a], [b]) => a - b)
    .map(([time, value]) => ({ time, value }));
}

/**
 * Works from the response's shape rather than the selected range: while a new
 * range loads, SWR is still handing back the previous range's data.
 */
export function parseChartResponse(raw: CandleChartResponse | LineChartResponse): ChartSeries {
  if ('candles' in raw) {
    return { kind: 'candles', candles: raw.candles, volume: raw.volume, analysisAllowed: raw.analysisAllowed };
  }

  return { kind: 'line', line: pointsFromPairs(raw.prices), volume: pointsFromPairs(raw.total_volumes) };
}

function liveCandle(candles: Candle[], price: number, time: number): Candle[] {
  const last = candles[candles.length - 1];

  if (time <= last.time) {
    return [
      ...candles.slice(0, -1),
      { ...last, close: price, high: Math.max(last.high, price), low: Math.min(last.low, price) },
    ];
  }

  // CoinGecko stamps a candle with its close time, so this is the one forming now.
  return [
    ...candles,
    { time, open: last.close, close: price, high: Math.max(last.close, price), low: Math.min(last.close, price) },
  ];
}

function liveLinePoint(line: LinePoint[], price: number, time: number): LinePoint[] {
  const last = line[line.length - 1];

  return time <= last.time
    ? [...line.slice(0, -1), { ...last, value: price }]
    : [...line, { time, value: price }];
}

/**
 * History is cached longer than the live price, so its end can lag. Finishing
 * on the live price keeps the chart and the price above it in agreement.
 */
export function withLivePrice(series: ChartSeries, price?: number | null, updatedAt?: string | null): ChartSeries {
  const timeMs = updatedAt ? new Date(updatedAt).getTime() : NaN;

  if (price == null || !Number.isFinite(price) || !Number.isFinite(timeMs)) {
    return series;
  }

  const time = Math.floor(timeMs / MS_PER_SECOND);

  if (series.kind === 'candles') {
    return series.candles.length ? { ...series, candles: liveCandle(series.candles, price, time) } : series;
  }

  return series.line.length ? { ...series, line: liveLinePoint(series.line, price, time) } : series;
}

export function summarizeSeries(series: ChartSeries): ChartSummary | null {
  const latestVolume = series.volume[series.volume.length - 1]?.value ?? null;

  if (series.kind === 'candles') {
    const { candles } = series;

    if (candles.length < 2) return null;

    return summary(
      candles[0].open,
      candles[candles.length - 1].close,
      Math.min(...candles.map((candle) => candle.low)),
      Math.max(...candles.map((candle) => candle.high)),
      latestVolume,
    );
  }

  const values = series.line.map((point) => point.value);

  if (values.length < 2) return null;

  return summary(values[0], values[values.length - 1], Math.min(...values), Math.max(...values), latestVolume);
}

function summary(first: number, last: number, low: number, high: number, latestVolume: number | null): ChartSummary {
  return { first, last, low, high, latestVolume, changePct: first ? ((last - first) / first) * 100 : 0 };
}

/**
 * The chart rounds its scale to this step. The library's default of 0.01 would
 * flatten a coin priced at 0.000004 into a single line.
 */
export function chartMinMove(price: number): number {
  if (!Number.isFinite(price) || price <= 0) return 0.01;

  return Math.min(0.01, 10 ** (Math.floor(Math.log10(price)) - 3));
}

/** Axis labels, in the visitor's own time zone. */
export function formatChartTick(time: number, range: ChartRange): string {
  const date = new Date(time * MS_PER_SECOND);

  if (range === '1d') {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  if (range === '1y') {
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  }

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Hover labels. The year view has daily points, so its time would mislead. */
export function formatChartTime(time: number, range: ChartRange): string {
  const date = new Date(time * MS_PER_SECOND);
  const day = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

  return range === '1y'
    ? day
    : `${day} · ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
}
