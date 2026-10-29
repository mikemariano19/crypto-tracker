import { describe, expect, it } from 'vitest';
import {
  PRICES_STORAGE_KEY,
  mergeSavedPrices,
  priceIds,
  pricesPath,
  pricesSchema,
  readSavedPrices,
  withFallback,
  writeSavedPrices,
  type PriceQuote,
} from '@/lib/wallet/prices';
import { mergeCoinResults, searchCoins } from '@/lib/wallet/coinSearch';
import type { SearchResult } from '@/hooks/useCoinSearch';

const quote = (usd: number): PriceQuote => ({
  usd,
  php: usd * 58,
  usd_24h_change: 1,
  php_24h_change: 1,
  last_updated_at: 1,
});

describe('price request key', () => {
  it('is the same for the same coins in any order', () => {
    expect(priceIds(['solana', 'bitcoin', 'solana', 'ethereum'])).toEqual(['bitcoin', 'ethereum', 'solana']);
    expect(pricesPath(priceIds(['ethereum', 'bitcoin']))).toBe(pricesPath(priceIds(['bitcoin', 'ethereum'])));
  });

  it('makes no request without coins', () => {
    expect(pricesPath([])).toBeNull();
  });
});

describe('pricesSchema', () => {
  it('accepts a map, and [] for no known coins', () => {
    expect(pricesSchema.parse({ bitcoin: quote(1) })).toEqual({ bitcoin: quote(1) });
    expect(pricesSchema.parse([])).toEqual({});
    expect(pricesSchema.safeParse({ bitcoin: { usd: 'x' } }).success).toBe(false);
  });
});

describe('saved price fallback', () => {
  it('keeps fresh quotes, older ones only for tracked coins', () => {
    const saved = { savedAt: 1, prices: { bitcoin: quote(1), dogecoin: quote(2), solana: quote(3) } };
    const merged = mergeSavedPrices(saved, { bitcoin: quote(10) }, ['bitcoin', 'solana'], 99);

    expect(merged).toEqual({ savedAt: 99, prices: { bitcoin: quote(10), solana: quote(3) } });
  });

  it('fills coins the live response lacks from the saved copy', () => {
    const saved = { savedAt: 1, prices: { bitcoin: quote(1), solana: quote(3) } };

    expect(withFallback({ bitcoin: quote(10) }, saved, ['bitcoin', 'solana', 'unknown'])).toEqual({
      bitcoin: quote(10),
      solana: quote(3),
    });
    expect(withFallback(undefined, null, ['bitcoin'])).toEqual({});
  });

  it('round-trips through storage and ignores junk', () => {
    const items = new Map<string, string>();
    const storage = { getItem: (k: string) => items.get(k) ?? null, setItem: (k: string, v: string) => void items.set(k, v) };

    writeSavedPrices(storage, { savedAt: 5, prices: { bitcoin: quote(1) } });
    expect(readSavedPrices(storage)).toEqual({ savedAt: 5, prices: { bitcoin: quote(1) } });

    items.set(PRICES_STORAGE_KEY, '{oops');
    expect(readSavedPrices(storage)).toBeNull();
    expect(readSavedPrices(undefined)).toBeNull();
  });
});

describe('coin picker search', () => {
  const coin = (id: string, symbol: string, name: string, rank: number | null): SearchResult => ({
    id, symbol, name, image: null, market_cap_rank: rank,
  });

  const list = [
    coin('wrapped-bitcoin', 'wbtc', 'Wrapped Bitcoin', 15),
    coin('bitcoin', 'btc', 'Bitcoin', 1),
    coin('bitcoin-cash', 'bch', 'Bitcoin Cash', 20),
    coin('ethereum', 'eth', 'Ethereum', 2),
    coin('ethena', 'ena', 'Ethena', 40),
  ];

  it('lists the biggest coins when empty', () => {
    expect(searchCoins(list, '', 2).map((c) => c.id)).toEqual(['bitcoin', 'ethereum']);
  });

  it('puts exact symbols first, then prefixes by rank', () => {
    expect(searchCoins(list, 'bit').map((c) => c.id)).toEqual(['bitcoin', 'bitcoin-cash', 'wrapped-bitcoin']);
    expect(searchCoins(list, 'ENA').map((c) => c.id)).toEqual(['ethena']);
    expect(searchCoins(list, 'eth').map((c) => c.id)).toEqual(['ethereum', 'ethena']);
  });

  it('adds server results without duplicates', () => {
    const remote = [coin('bitcoin', 'btc', 'Bitcoin', 1), coin('bitcoin-gold', 'btg', 'Bitcoin Gold', 300)];
    expect(mergeCoinResults([list[1]], remote).map((c) => c.id)).toEqual(['bitcoin', 'bitcoin-gold']);
  });
});
