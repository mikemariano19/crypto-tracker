import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import { ApiError, apiUrl, fetchApi, postApi } from '@/lib/api';
import { insightUrlPath } from '@/lib/insight';
import type { InsightTimeframe, PriceInsight } from '@/types/insight';

// Longer than a sleeping server takes to wake and run one analysis.
const RUN_TIMEOUT_MS = 90_000;

/** "No analysis yet" is a normal answer here, not a failure. */
async function fetchCached(url: string): Promise<PriceInsight | null> {
  try {
    return await fetchApi<PriceInsight>(url);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;

    throw error;
  }
}

const insightKey = (coinId: string, timeframe: InsightTimeframe | null) =>
  timeframe ? apiUrl(insightUrlPath(coinId, timeframe)) : null;

/**
 * Whether a fresh analysis exists. Never starts one and never polls. Pass a
 * null timeframe to skip the request for ranges and coins without analysis.
 */
export function useCachedInsight(coinId: string, timeframe: InsightTimeframe | null) {
  const { data } = useSWR<PriceInsight | null>(insightKey(coinId, timeframe), fetchCached, {
    revalidateOnFocus: false,
    revalidateIfStale: false,
    shouldRetryOnError: false,
  });

  return data ?? null;
}

/**
 * The "AI Analyze" click. The only thing in the app that can spend AI credits.
 * The result lands in the same cache entry useCachedInsight reads.
 */
export function useRunInsight(coinId: string, timeframe: InsightTimeframe | null) {
  const { trigger, isMutating, error, reset } = useSWRMutation<PriceInsight, ApiError, string | null>(
    insightKey(coinId, timeframe),
    (url: string) => postApi<PriceInsight>(url, RUN_TIMEOUT_MS),
    { populateCache: true, revalidate: false, throwOnError: false },
  );

  return { run: trigger, isRunning: isMutating, error: error ?? null, reset };
}
