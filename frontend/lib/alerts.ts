import { z } from 'zod';
import type { PriceMap } from '@/lib/wallet/prices';
import { AMOUNT_PATTERN, currencySchema, type Currency } from '@/lib/wallet/schema';
import { Dec, parseAmount } from '@/lib/wallet/validate';

// Price alerts: "tell me when BTC goes above $100,000". Saved in this
// browser only and checked by the watcher in the layout while a tab is
// open. Each alert fires once, then waits to be re-armed.

export const ALERTS_STORAGE_KEY = 'cryptoTracker.alerts.v1';
export const MAX_ALERTS = 100;

/** Older quotes are never acted on, so a saved fallback can't fire an alert. */
export const MAX_QUOTE_AGE_MS = 15 * 60_000;

export const alertSchema = z.object({
  id: z.string().min(1).max(64),
  coinId: z.string().min(1).max(100),
  symbol: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  image: z.url({ protocol: /^https$/ }).optional(),
  condition: z.enum(['above', 'below']),
  target: z.string().regex(AMOUNT_PATTERN),
  currency: currencySchema,
  createdAt: z.iso.datetime(),
  triggered: z.object({ at: z.iso.datetime(), price: z.number() }).optional(),
});

const storedAlertsSchema = z.object({
  version: z.literal(1),
  alerts: z.array(alertSchema).max(MAX_ALERTS),
});

export type PriceAlert = z.infer<typeof alertSchema>;
export type AlertCondition = PriceAlert['condition'];

export type AlertCoin = Pick<PriceAlert, 'coinId' | 'symbol' | 'name' | 'image'>;

export type AlertInput = {
  coin: AlertCoin;
  condition: AlertCondition;
  target: string;
  currency: Currency;
};

export function parseAlerts(raw: string | null): PriceAlert[] {
  if (!raw) return [];

  try {
    const parsed = storedAlertsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data.alerts : [];
  } catch {
    return [];
  }
}

export function serializeAlerts(alerts: readonly PriceAlert[]): string {
  return JSON.stringify({ version: 1, alerts });
}

export function createAlert(
  alerts: readonly PriceAlert[],
  input: AlertInput,
  clock: { now: () => string; newId: () => string }
): { ok: true; alert: PriceAlert } | { ok: false; error: string } {
  const target = parseAmount(input.target, 'Price');
  if (!target.ok) return target;

  if (alerts.length >= MAX_ALERTS) return { ok: false, error: `You can keep up to ${MAX_ALERTS} alerts. Delete some first.` };

  const duplicate = alerts.some(
    (alert) =>
      !alert.triggered &&
      alert.coinId === input.coin.coinId &&
      alert.condition === input.condition &&
      alert.currency === input.currency &&
      new Dec(alert.target).eq(target.amount)
  );
  if (duplicate) return { ok: false, error: 'You already have this alert.' };

  return {
    ok: true,
    alert: {
      id: clock.newId(),
      coinId: input.coin.coinId,
      symbol: input.coin.symbol.toUpperCase(),
      name: input.coin.name,
      // The schema only takes https images; one bad field would fail the whole saved list.
      image: input.coin.image?.startsWith('https://') ? input.coin.image : undefined,
      condition: input.condition,
      target: target.amount,
      currency: input.currency,
      createdAt: clock.now(),
    },
  };
}

/** True when `price` has crossed the alert's target (touching it counts). */
export function isMet(alert: Pick<PriceAlert, 'condition' | 'target'>, price: number): boolean {
  const cmp = new Dec(String(price)).comparedTo(alert.target);
  return alert.condition === 'above' ? cmp >= 0 : cmp <= 0;
}

export type AlertHit = { alert: PriceAlert; price: number };

/**
 * Armed alerts whose coin has a fresh quote past the target. Quotes older
 * than MAX_QUOTE_AGE_MS are skipped: they may be the saved offline copy.
 */
export function dueAlerts(alerts: readonly PriceAlert[], prices: PriceMap, now: number): AlertHit[] {
  const hits: AlertHit[] = [];

  for (const alert of alerts) {
    if (alert.triggered) continue;

    const quote = prices[alert.coinId];
    const price = quote?.[alert.currency];
    const updatedAt = quote?.last_updated_at;

    if (price == null || updatedAt == null) continue;
    if (now - updatedAt * 1000 > MAX_QUOTE_AGE_MS) continue;

    if (isMet(alert, price)) hits.push({ alert, price });
  }

  return hits;
}

/** The verb in "BTC rises above $100,000", shared by the list and the form. */
export function conditionText(condition: AlertCondition): string {
  return condition === 'above' ? 'rises above' : 'drops below';
}
