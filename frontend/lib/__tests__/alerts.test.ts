import { describe, expect, it } from 'vitest';
import { createAlert, dueAlerts, isMet, parseAlerts, serializeAlerts, MAX_QUOTE_AGE_MS, type PriceAlert } from '@/lib/alerts';
import type { PriceQuote } from '@/lib/wallet/prices';

let ids = 0;
const clock = { newId: () => `a-${++ids}`, now: () => '2026-11-01T00:00:00.000Z' };
const btc = { coinId: 'bitcoin', symbol: 'btc', name: 'Bitcoin', image: 'https://example.com/btc.png' };

const NOW = Date.UTC(2026, 10, 1, 12, 0, 0);

const quote = (usd: number, ageMs = 0): PriceQuote => ({
  usd,
  php: usd * 58,
  usd_24h_change: 0,
  php_24h_change: 0,
  last_updated_at: Math.floor((NOW - ageMs) / 1000),
});

function make(condition: 'above' | 'below', target: string, alerts: PriceAlert[] = []): PriceAlert {
  const result = createAlert(alerts, { coin: btc, condition, target, currency: 'usd' }, clock);
  if (!result.ok) throw new Error(result.error);
  return result.alert;
}

describe('creating alerts', () => {
  it('stores a canonical target and an upper-case symbol', () => {
    expect(make('above', ' 100,5 ')).toMatchObject({ symbol: 'BTC', target: '100.5', condition: 'above' });
  });

  it('rejects bad prices, duplicates and non-https images', () => {
    expect(createAlert([], { coin: btc, condition: 'above', target: '-1', currency: 'usd' }, clock)).toMatchObject({ ok: false });

    const first = make('above', '100');
    expect(createAlert([first], { coin: btc, condition: 'above', target: '100.00', currency: 'usd' }, clock)).toMatchObject({ ok: false });

    const http = createAlert([], { coin: { ...btc, image: 'http://x/y.png' }, condition: 'above', target: '1', currency: 'usd' }, clock);
    expect(http.ok && http.alert.image).toBeUndefined();
  });

  it('round-trips through storage and drops anything unreadable', () => {
    const alerts = [make('above', '100'), make('below', '50')];
    expect(parseAlerts(serializeAlerts(alerts))).toEqual(alerts);
    expect(parseAlerts('{"version":2,"alerts":[]}')).toEqual([]);
    expect(parseAlerts('not json')).toEqual([]);
  });
});

describe('checking alerts', () => {
  it('fires when the target is reached or crossed', () => {
    expect(isMet({ condition: 'above', target: '100' }, 100)).toBe(true);
    expect(isMet({ condition: 'above', target: '100' }, 99.99)).toBe(false);
    expect(isMet({ condition: 'below', target: '100' }, 100)).toBe(true);
    expect(isMet({ condition: 'below', target: '0.00001' }, 0.000011)).toBe(false);
  });

  it('only acts on fresh quotes for armed alerts', () => {
    const up = make('above', '100');
    const down = make('below', '50');
    const fired = { ...make('above', '10'), triggered: { at: clock.now(), price: 11 } };

    expect(dueAlerts([up, down, fired], { bitcoin: quote(120) }, NOW).map((hit) => hit.alert.id)).toEqual([up.id]);
    expect(dueAlerts([up], { bitcoin: quote(120, MAX_QUOTE_AGE_MS + 1) }, NOW)).toEqual([]);
    expect(dueAlerts([up], {}, NOW)).toEqual([]);
  });

  it('compares in the alert’s own currency', () => {
    const php = createAlert([], { coin: btc, condition: 'above', target: '5800', currency: 'php' }, clock);
    if (!php.ok) throw new Error(php.error);

    // $100 is ₱5,800 in these quotes.
    expect(dueAlerts([php.alert], { bitcoin: quote(100) }, NOW)).toHaveLength(1);
    expect(dueAlerts([php.alert], { bitcoin: quote(99) }, NOW)).toHaveLength(0);
  });
});
