import { describe, expect, it } from 'vitest';
import {
  insightTimeframe,
  insightUrlPath,
  isInsightFresh,
  nearestLevelsText,
  pinsOnCandles,
  snapToCandles,
  zonesByPrice,
} from '@/lib/insight';
import { USD_MONEY } from '@/lib/money';
import type { NewsPin, PriceInsight, PriceZone } from '@/types/insight';

const zone = (id: string, type: PriceZone['type'], from: number, distancePct: number): PriceZone => ({
  id,
  type,
  from,
  to: from + 2,
  distancePct,
  strength: 'moderate',
  touches: 2,
  testing: false,
});

describe('insightTimeframe', () => {
  it('only exists for the candle ranges', () => {
    expect(insightTimeframe('1d')).toBe('1d');
    expect(insightTimeframe('7d')).toBe('7d');
    expect(insightTimeframe('30d')).toBeNull();
    expect(insightTimeframe('90d')).toBeNull();
    expect(insightTimeframe('1y')).toBeNull();
  });
});

describe('insightUrlPath', () => {
  it('escapes the coin id', () => {
    expect(insightUrlPath('a/b', '1d')).toBe('/api/insight/a%2Fb?tf=1d');
  });
});

describe('isInsightFresh', () => {
  const insight = { expiresAt: '2026-11-06T12:00:00Z' } as PriceInsight;
  const expiry = new Date(insight.expiresAt).getTime();

  it('compares with the expiry', () => {
    expect(isInsightFresh(insight, expiry - 1)).toBe(true);
    expect(isInsightFresh(insight, expiry)).toBe(false);
  });

  it('counts as fresh until the clock has started', () => {
    expect(isInsightFresh(insight, 0)).toBe(true);
  });
});

describe('snapToCandles', () => {
  it('leaves matching times alone', () => {
    const line = [{ time: 10, value: 1 }, { time: 20, value: 2 }];

    expect(snapToCandles(line, [10, 20])).toEqual(line);
  });

  it('moves a point onto the candle at or just after it', () => {
    expect(snapToCandles([{ time: 12, value: 1 }], [10, 20, 30])).toEqual([{ time: 20, value: 1 }]);
  });

  it('keeps the newest value when two land on one candle', () => {
    expect(snapToCandles([{ time: 11, value: 1 }, { time: 15, value: 2 }], [10, 20])).toEqual([{ time: 20, value: 2 }]);
  });

  it('drops points newer than the last candle, and never adds candle times', () => {
    expect(snapToCandles([{ time: 10, value: 1 }, { time: 25, value: 2 }], [10, 20])).toEqual([{ time: 10, value: 1 }]);
  });

  it('copes with nothing to snap to', () => {
    expect(snapToCandles([{ time: 10, value: 1 }], [])).toEqual([]);
    expect(snapToCandles([], [10])).toEqual([]);
  });
});

describe('pinsOnCandles', () => {
  const pin = (time: number, headline = 'Story', url = 'https://news.test/a'): NewsPin => ({
    time,
    headline,
    url,
    source: 'Test',
    label: 'bullish',
  });

  it('moves a story onto the candle covering it, oldest first', () => {
    const result = pinsOnCandles([pin(25, 'Later'), pin(12, 'Earlier')], [10, 20, 30]);

    expect(result.map(({ time, headline }) => [time, headline])).toEqual([[20, 'Earlier'], [30, 'Later']]);
  });

  it('leaves out stories older than the chart', () => {
    expect(pinsOnCandles([pin(5)], [10, 20])).toEqual([]);
  });

  it('keeps a story newer than the last candle, on that candle', () => {
    expect(pinsOnCandles([pin(25)], [10, 20])[0].time).toBe(20);
  });

  it('keeps every story on a shared candle', () => {
    expect(pinsOnCandles([pin(11), pin(12)], [10, 20])).toHaveLength(2);
  });

  it('drops a link that is not a web address', () => {
    expect(pinsOnCandles([pin(15, 'Bad', 'javascript:alert(1)')], [10, 20])).toEqual([]);
  });

  it('copes with no candles', () => {
    expect(pinsOnCandles([pin(5)], [])).toEqual([]);
  });
});

describe('zonesByPrice', () => {
  it('reads like a price ladder, highest first', () => {
    const zones = [zone('R1', 'resistance', 110, 10), zone('S1', 'support', 90, -10), zone('R2', 'resistance', 120, 20), zone('S2', 'support', 80, -20)];

    expect(zonesByPrice(zones).map((level) => level.id)).toEqual(['R2', 'R1', 'S1', 'S2']);
  });

  it('does not change the original order', () => {
    const zones = [zone('S1', 'support', 90, -10), zone('R1', 'resistance', 110, 10)];

    zonesByPrice(zones);

    expect(zones[0].id).toBe('S1');
  });
});

describe('nearestLevelsText', () => {
  it('names the closest level on each side', () => {
    const zones = [zone('R2', 'resistance', 120, 20), zone('R1', 'resistance', 110, 10), zone('S1', 'support', 90, -10)];

    expect(nearestLevelsText(zones, USD_MONEY)).toBe('Nearest resistance $111.00. Nearest support $91.00.');
  });

  it('says so when a side has none', () => {
    expect(nearestLevelsText([zone('R1', 'resistance', 110, 10)], USD_MONEY)).toBe('Nearest resistance $111.00. No support level found.');
    expect(nearestLevelsText([], USD_MONEY)).toBe('No resistance level found. No support level found.');
  });
});
