import { formatFiatPrice, type Money } from '@/lib/money';
import type { ChartRange, LinePoint } from '@/types/chart';
import type { InsightTimeframe, NewsPin, PriceInsight, PriceZone } from '@/types/insight';

export function insightTimeframe(range: ChartRange): InsightTimeframe | null {
  return range === '1d' || range === '7d' || range === '30d' ? range : null;
}

export function insightUrlPath(coinId: string, timeframe: InsightTimeframe): string {
  return `/api/insight/${encodeURIComponent(coinId)}?tf=${timeframe}`;
}

export function zoneMiddle(zone: PriceZone): number {
  return (zone.from + zone.to) / 2;
}

/**
 * `now` is 0 until the clock starts in the browser. A result is treated as
 * fresh until then, so nothing flips right after hydration.
 */
export function isInsightFresh(insight: PriceInsight, now: number): boolean {
  return now === 0 || new Date(insight.expiresAt).getTime() > now;
}

/**
 * The analysis and the chart are cached separately and can disagree on exact
 * candle times. The chart lines each time up on one shared scale, so a stray
 * time would open a gap between candles. This moves each point onto the candle
 * at or just after it, keeping the newest value when several land on one.
 *
 * @param times candle times, ascending
 */
export function snapToCandles(line: LinePoint[], times: number[]): LinePoint[] {
  if (times.length === 0) return [];

  const snapped = new Map<number, number>();
  let index = 0;

  for (const point of line) {
    while (index < times.length && times[index] < point.time) {
      index++;
    }

    // Past the newest candle: nothing to attach it to.
    if (index === times.length) break;

    snapped.set(times[index], point.value);
  }

  return [...snapped.entries()].map(([time, value]) => ({ time, value }));
}

/**
 * News pins moved onto the candle covering their publish time. A story older
 * than the chart is left out. One newer than the last candle goes on that
 * candle, since the chart's data can simply be a few minutes behind the feed.
 *
 * @param times candle times, ascending
 */
export function pinsOnCandles(pins: NewsPin[], times: number[]): NewsPin[] {
  if (times.length === 0) return [];

  const last = times[times.length - 1];

  return pins
    .filter((pin) => pin.time >= times[0] && /^https?:\/\//i.test(pin.url))
    .map((pin) => ({ ...pin, time: times.find((time) => time >= pin.time) ?? last }))
    .sort((a, b) => a.time - b.time);
}

/** Resistances furthest first, then supports nearest first, like a price ladder. */
export function zonesByPrice(zones: PriceZone[]): PriceZone[] {
  return [...zones].sort((a, b) => zoneMiddle(b) - zoneMiddle(a));
}

/** What a screen reader gets in place of the zones drawn on the chart. */
export function nearestLevelsText(zones: PriceZone[], money: Money): string {
  const nearest = (type: PriceZone['type']) =>
    zones
      .filter((zone) => zone.type === type)
      .sort((a, b) => Math.abs(a.distancePct) - Math.abs(b.distancePct))[0];

  const resistance = nearest('resistance');
  const support = nearest('support');

  return [
    resistance ? `Nearest resistance ${formatFiatPrice(zoneMiddle(resistance), money)}.` : 'No resistance level found.',
    support ? `Nearest support ${formatFiatPrice(zoneMiddle(support), money)}.` : 'No support level found.',
  ].join(' ');
}

/**
 * How a level relates to the 30D chart, for 1D and 7D analyses: a level both
 * charts agree on, or one only the 30D chart can see. Null for anything else.
 */
export function higherTimeframeTag(zone: PriceZone, timeframe: InsightTimeframe): string | null {
  if (zone.confluence) return 'Also 30D';

  return zone.source && zone.source !== timeframe ? `${zone.source.toUpperCase()} level` : null;
}
