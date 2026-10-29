import type { Level, SentimentLabel, SentimentSplit } from '@/types/news';

/**
 * "2h ago" style age for news timestamps.
 */
export function formatRelativeTime(iso: string, now: number): string {
  const seconds = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86_400)}d ago`;
}

/**
 * Full local date and time, for title tooltips.
 */
export function formatLocalTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function formatClockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

/**
 * Signed percentage: +2.4%, -0.85%.
 */
export function formatSignedPct(value: number, decimals = 2): string {
  const rounded = Number(value.toFixed(decimals));
  return `${rounded > 0 ? '+' : ''}${rounded.toFixed(decimals)}%`;
}

export function sentimentAriaLabel(split: SentimentSplit): string {
  return `${split.bullish} percent bullish, ${split.neutral} percent neutral, ${split.bearish} percent bearish`;
}

export const LABEL_TEXT: Record<SentimentLabel, string> = {
  bullish: 'Bullish',
  bearish: 'Bearish',
  neutral: 'Neutral',
};

export const LEVEL_TEXT: Record<Level, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

// Soft pastel fills (easy on the eyes) with dark text on top for contrast;
// `line` is a step deeper so thin chart lines and the gauge stay visible.
export const SENTIMENT_STYLES: Record<
  SentimentLabel,
  { text: string; bg: string; bar: string; barText: string; stripe: string; hex: string; line: string }
> = {
  bullish: {
    text: 'text-green-700',
    bg: 'bg-green-50',
    bar: 'bg-green-600',
    barText: 'text-white',
    stripe: 'border-l-green-600',
    hex: '#16a34a',
    line: '#16a34a',
  },
  neutral: {
    text: 'text-slate-600',
    bg: 'bg-slate-100',
    bar: 'bg-slate-300',
    barText: 'text-slate-800',
    stripe: 'border-l-slate-300',
    hex: '#cbd5e1',
    line: '#94a3b8',
  },
  bearish: {
    text: 'text-red-700',
    bg: 'bg-red-50',
    bar: 'bg-red-600',
    barText: 'text-white',
    stripe: 'border-l-red-600',
    hex: '#dc2626',
    line: '#dc2626',
  },
};
