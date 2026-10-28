import useSWR from 'swr';
import { useMemo } from 'react';
import { apiUrl, fetchApi } from '@/lib/api';

export type ChartRange = '1' | '7' | '30' | '90' | '365';

export type ChartPoint = {
  timestamp: number;
  price: number;
  volume: number | null;
};

type ChartResponse = {
  prices: [number, number][];
  total_volumes?: [number, number][];
};

export function useCoinChart(coinId: string, days: ChartRange) {
  const { data, error, isLoading, isValidating, mutate } = useSWR<ChartResponse>(
    apiUrl(`/api/coin/${encodeURIComponent(coinId)}/chart?days=${days}`),
    fetchApi,
    {
      // Keep the previous range on screen while the next one loads.
      keepPreviousData: true,
      revalidateOnFocus: false,
      // Intraday data moves; longer ranges barely change within a visit.
      refreshInterval: days === '1' ? 60_000 : 0,
      dedupingInterval: 30_000,
      onError: (err: Error) => {
        console.warn('Chart fetch failed:', err.message);
      },
    }
  );

  const points = useMemo<ChartPoint[]>(() => {
    const prices = data?.prices ?? [];
    const volumes = data?.total_volumes ?? [];

    return prices
      .map(([timestamp, price], index) => ({
        timestamp,
        price,
        volume: volumes[index]?.[1] ?? null,
      }))
      .filter((point) => Number.isFinite(point.price));
  }, [data]);

  return {
    points,
    isLoading,
    isValidating,
    isError: !!error,
    retry: () => mutate(),
  };
}
