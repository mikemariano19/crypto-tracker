import { useCallback, useMemo } from 'react';
import useSWR from 'swr';
import { apiUrl, fetchApiWithMeta, type ApiResult } from '@/lib/api';
import {
  mergeSavedPrices,
  priceIds,
  pricesPath,
  pricesSchema,
  readSavedPrices,
  withFallback,
  writeSavedPrices,
  type PriceMap,
  type SavedPrices,
} from '@/lib/wallet/prices';

// The last good prices, read from this browser once and kept in step with
// every successful fetch. Only touched on the client.
let saved: SavedPrices | null | undefined;

function browserStorage(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

function savedPrices(): SavedPrices | null {
  if (saved === undefined) saved = readSavedPrices(browserStorage());
  return saved;
}

async function fetchPrices(url: string): Promise<ApiResult<PriceMap>> {
  const result = await fetchApiWithMeta<unknown>(url);
  const parsed = pricesSchema.safeParse(result.data);

  if (!parsed.success) throw new Error('Unexpected price data from API');

  return { ...result, data: parsed.data };
}

export type CoinPrices = {
  /** Quote per coin id; coins with no live or saved price are missing. */
  prices: PriceMap;
  /** Ids we have no price for at all (excluded from totals). */
  missing: string[];
  /** When these prices were fetched (ms), live or saved. */
  updatedAt: number | null;
  /** A fresh fetch failed, so these are saved or server-cached prices. */
  isStale: boolean;
  /** First load, nothing to show yet. */
  isLoading: boolean;
  isRefreshing: boolean;
  refresh: () => void;
};

/**
 * USD and PHP prices for every coin in the user's wallets, in one request
 * that refreshes every minute. Falls back to the last prices saved in this
 * browser when the API can't be reached. No request when there are no coins.
 */
export function useCoinPrices(coinIds: readonly string[]): CoinPrices {
  // Joined so a new array with the same coins doesn't change anything.
  const idsKey = priceIds(coinIds).join(',');
  const ids = useMemo(() => (idsKey ? idsKey.split(',') : []), [idsKey]);
  const path = pricesPath(ids);

  const { data, error, isLoading, isValidating, mutate } = useSWR(path ? apiUrl(path) : null, fetchPrices, {
    refreshInterval: 60_000,
    revalidateOnFocus: true,
    dedupingInterval: 30_000,
    keepPreviousData: true,
    onSuccess: (result) => {
      saved = mergeSavedPrices(savedPrices(), result.data, ids, Date.now());
      writeSavedPrices(browserStorage(), saved);
    },
  });

  const refresh = useCallback(() => {
    void mutate();
  }, [mutate]);

  return useMemo(() => {
    const fallback = ids.length > 0 ? savedPrices() : null;
    const prices = withFallback(data?.data, fallback, ids);
    const missing = ids.filter((id) => !prices[id]);
    const usingSaved = !data && fallback !== null && Object.keys(prices).length > 0;

    const liveAt = data?.cachedAt ? Date.parse(data.cachedAt) : null;

    return {
      prices,
      missing,
      updatedAt: liveAt ?? (usingSaved ? fallback.savedAt : null),
      // Saved prices shown while the first fetch is still running aren't
      // "outdated" yet; only a failed fetch or the API's own fallback is.
      isStale: Boolean(error) || Boolean(data?.stale),
      isLoading: isLoading && Object.keys(prices).length === 0,
      isRefreshing: isValidating,
      refresh,
    };
  }, [data, error, ids, isLoading, isValidating, refresh]);
}
