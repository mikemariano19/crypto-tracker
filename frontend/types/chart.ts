// Shapes for the coin price chart. Prices and volumes are USD; times are Unix
// seconds, which is what the chart library plots.

export type ChartRange = '1d' | '7d' | '30d' | '90d' | '1y';

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface LinePoint {
  time: number;
  value: number;
}

export type VolumePoint = LinePoint;

export interface CandleSeries {
  kind: 'candles';
  candles: Candle[];
  volume: VolumePoint[];
  analysisAllowed: boolean;
}

export interface LineSeries {
  kind: 'line';
  line: LinePoint[];
  volume: VolumePoint[];
}

export type ChartSeries = CandleSeries | LineSeries;

export interface ChartSummary {
  first: number;
  last: number;
  low: number;
  high: number;
  changePct: number;
  /** A rolling 24h total, the only volume CoinGecko's free tier provides. */
  latestVolume: number | null;
}

/** GET /api/coins/{id}/chart */
export interface CandleChartResponse {
  candles: Candle[];
  volume: VolumePoint[];
  analysisAllowed: boolean;
}

/** GET /api/coin/{id}/chart */
export interface LineChartResponse {
  prices: [number, number][];
  total_volumes?: [number, number][];
}
