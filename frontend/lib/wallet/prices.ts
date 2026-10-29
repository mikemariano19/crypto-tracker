import { z } from 'zod';

// Wallet-tracker prices: what /api/prices returns, plus the last good copy
// kept in this browser for when the API can't be reached.

export const PRICES_STORAGE_KEY = 'cryptoTracker.prices.v1';

const quoteSchema = z.object({
  usd: z.number().nullable(),
  php: z.number().nullable(),
  usd_24h_change: z.number().nullable(),
  php_24h_change: z.number().nullable(),
  last_updated_at: z.number().nullable(),
});

/** id → quote. [] is accepted too, in case an empty map is ever encoded as a PHP list. */
export const pricesSchema = z.union([
  z.record(z.string(), quoteSchema),
  z.array(z.never()).transform((): Record<string, PriceQuote> => ({})),
]);

const savedPricesSchema = z.object({
  savedAt: z.number(),
  prices: z.record(z.string(), quoteSchema),
});

export type PriceQuote = z.infer<typeof quoteSchema>;
export type PriceMap = Record<string, PriceQuote>;
export type SavedPrices = z.infer<typeof savedPricesSchema>;

/**
 * Sorted, de-duplicated ids: the same coins in any order make the same
 * request, so reordering holdings never refetches.
 */
export function priceIds(coinIds: readonly string[]): string[] {
  return [...new Set(coinIds)].sort();
}

export function pricesPath(ids: readonly string[]): string | null {
  return ids.length > 0 ? `/api/prices?ids=${ids.map(encodeURIComponent).join(',')}` : null;
}

export function readSavedPrices(storage: Pick<Storage, 'getItem'> | undefined): SavedPrices | null {
  try {
    const raw = storage?.getItem(PRICES_STORAGE_KEY);
    if (!raw) return null;

    const parsed = savedPricesSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * Saved copy after a successful fetch: fresh quotes win, older quotes are
 * kept only for coins still being tracked, so the entry never grows forever.
 */
export function mergeSavedPrices(saved: SavedPrices | null, fresh: PriceMap, ids: readonly string[], now: number): SavedPrices {
  const prices: PriceMap = {};

  for (const id of ids) {
    const quote = fresh[id] ?? saved?.prices[id];
    if (quote) prices[id] = quote;
  }

  return { savedAt: now, prices };
}

export function writeSavedPrices(storage: Pick<Storage, 'setItem'> | undefined, saved: SavedPrices): void {
  try {
    storage?.setItem(PRICES_STORAGE_KEY, JSON.stringify(saved));
  } catch {
    // Full or blocked: the fallback is a nice-to-have, prices still work live.
  }
}

/**
 * Live prices where we have them, the saved copy for the rest.
 */
export function withFallback(live: PriceMap | undefined, saved: SavedPrices | null, ids: readonly string[]): PriceMap {
  const prices: PriceMap = {};

  for (const id of ids) {
    const quote = live?.[id] ?? saved?.prices[id];
    if (quote) prices[id] = quote;
  }

  return prices;
}
