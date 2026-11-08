import useSWR from 'swr';
import { useEffect } from 'react';
import { listen } from '@/lib/echo';
import { apiUrl, fetchApi } from '@/lib/api';
import type { RankedCoin } from '@/types/crypto';

// Shared by the home card and the /trending page.
const TRENDING_KEY = apiUrl('/api/trending');

export function useTrendingCoins() {
  const { data, error, isLoading, isValidating, mutate } = useSWR<RankedCoin[]>(
    TRENDING_KEY,
    fetchApi,
    {
      refreshInterval: 30_000,
      revalidateOnFocus: false,
      keepPreviousData: true,
      onError: (err: Error) => {
        console.warn('Trending coins fetch failed:', err.message);
      },
    }
  );

  useEffect(
    () => listen<{ stats: RankedCoin[] }>('trending-coins', '.trending-coins.updated', (event) => {
      mutate(event.stats, false); // update cache without refetch
    }),
    [mutate],
  );

  return {
    coins: data ?? [],
    isLoading,
    isValidating,
    isError: !!error,
    mutate,
  };
}
