import useSWR from 'swr';
import { useEffect } from 'react';
import { listen } from '@/lib/echo';
import { apiUrl, fetchApi } from '@/lib/api';
import type { RankedCoin } from '@/types/crypto';

// The home card and the /top-gainers page share this key, so opening the
// full list is instant once the card has loaded.
const TOP_GAINERS_KEY = apiUrl('/api/top-gainers');

export function useTopGainers() {
  const { data, error, isLoading, isValidating, mutate } = useSWR<RankedCoin[]>(
    TOP_GAINERS_KEY,
    fetchApi,
    {
      refreshInterval: 30_000,
      revalidateOnFocus: false,
      keepPreviousData: true,
      onError: (err: Error) => {
        console.warn('Top gainers fetch failed:', err.message);
      },
    }
  );

  useEffect(
    () => listen<{ stats: RankedCoin[] }>('top-gainers', '.top-gainers.updated', (event) => {
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
