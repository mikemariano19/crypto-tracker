// Shapes returned by /api/insight/{id} (see backend App\Services\Insight).
// Prices are USD; the frontend converts them for display.

import type { LinePoint } from '@/types/chart';
import type { Level, SentimentLabel, SentimentSplit } from '@/types/news';

export type InsightTimeframe = '1d' | '7d' | '30d';
export type Strength = 'weak' | 'moderate' | 'strong';
export type Trend = 'up' | 'down' | 'sideways';
export type RsiState = 'overbought' | 'oversold' | 'neutral';
export type VolumeLabel = 'high' | 'normal' | 'low';
export type AiStatus = 'ok' | 'unavailable' | 'budget_paused';

export interface PriceZone {
  id: string; // "R1" | "S1" | ...
  type: 'support' | 'resistance';
  from: number;
  to: number;
  distancePct: number;
  strength: Strength;
  touches: number;
  /** How many tests the level held and how many went through it. Missing on results cached before these existed. */
  rejections?: number;
  breaks?: number;
  testing: boolean;
  /** The chart the level was found on: this analysis's own, or 30D's. Missing on older results. */
  source?: InsightTimeframe;
  /** Found on this chart and also a 30D level. */
  confluence?: boolean;
}

export interface AiOutlook {
  outlook: SentimentSplit;
  label: SentimentLabel;
  confidence: Level;
  summary: string;
  reasons: string[];
  watch: string;
}

export interface NewsPin {
  time: number;
  headline: string;
  source: string;
  url: string;
  label: SentimentLabel;
}

export interface PriceInsight {
  coinId: string;
  timeframe: InsightTimeframe;
  price: number;
  zones: PriceZone[];
  ema20: LinePoint[];
  ema50: LinePoint[];
  rsi: LinePoint[];
  rsiLatest: number | null;
  rsiState: RsiState | null;
  volume: { vsAvgPct: number; label: VolumeLabel } | null;
  trend: Trend;
  newsPins: NewsPin[];
  ai: AiOutlook | null;
  aiStatus: AiStatus;
  /** How past outlooks turned out. Null until there are enough to be fair. */
  accuracy: { matchedPct: number; sample: number; days: number } | null;
  analyzedAt: string;
  expiresAt: string;
}

export interface InsightToggles {
  ma: boolean;
  rsi: boolean;
  volume: boolean;
  sr: boolean;
}
