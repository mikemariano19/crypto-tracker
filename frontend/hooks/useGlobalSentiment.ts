import useSWR from 'swr';
import { apiUrl, fetchApi } from '@/lib/api';
import type { GlobalSentimentSnapshot } from '@/types/news';

export const GLOBAL_SENTIMENT_KEY = apiUrl('/api/news/sentiment/global');

export function useGlobalSentiment() {
  const { data, error, isLoading, isValidating, mutate } = useSWR<GlobalSentimentSnapshot>(
    GLOBAL_SENTIMENT_KEY,
    fetchApi,
    {
      // Fallback only: new batches arrive through the Echo event.
      refreshInterval: 15 * 60_000,
      revalidateOnFocus: false,
      keepPreviousData: true,
      onError: (err: Error) => {
        console.warn('Global sentiment fetch failed:', err.message);
      },
    },
  );

  return {
    snapshot: data ?? null,
    isLoading,
    isValidating,
    isError: !!error,
    retry: () => mutate(),
  };
}
