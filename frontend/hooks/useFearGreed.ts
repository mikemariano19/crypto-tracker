import useSWR from 'swr';
import { apiUrl, fetchApi } from '@/lib/api';

export type FearGreed = {
  value: number;
  classification: string | null;
  previous_value: number | null;
  updated_at: string | null;
};

export function useFearGreed() {
  const { data, isLoading } = useSWR<FearGreed>(apiUrl('/api/fear-greed'), fetchApi, {
    // The index is published once a day; an hourly check is plenty.
    refreshInterval: 60 * 60 * 1000,
    revalidateOnFocus: false,
    keepPreviousData: true,
    onError: (err: Error) => {
      console.warn('Fear & Greed fetch failed:', err.message);
    },
  });

  return { fearGreed: data, isLoading };
}
