import useSWR from 'swr';
import { useEffect } from 'react';
import { getEcho } from '@/lib/echo';
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

  useEffect(() => {
    const channel = getEcho().channel('trending-coins');

    channel.listen(
      '.trending-coins.updated',
      (event: { stats: RankedCoin[] }) => {
        mutate(event.stats, false); // update cache without refetch
      }
    );

    return () => {
      channel.stopListening('.trending-coins.updated');
    };
  }, [mutate]);

  return {
    coins: data ?? [],
    isLoading,
    isValidating,
    isError: !!error,
    mutate,
  };
}
