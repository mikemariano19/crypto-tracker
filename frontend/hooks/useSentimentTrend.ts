import useSWR from 'swr';
import { apiUrl, fetchApi } from '@/lib/api';
import type { SentimentTrendPoint } from '@/types/news';

export function sentimentTrendKey(days: number) {
  return apiUrl(`/api/news/sentiment/trend?days=${days}`);
}

export function useSentimentTrend(days = 7) {
  const { data, error, isLoading } = useSWR<SentimentTrendPoint[]>(sentimentTrendKey(days), fetchApi, {
    refreshInterval: 15 * 60_000,
    revalidateOnFocus: false,
    keepPreviousData: true,
    onError: (err: Error) => {
      console.warn('Sentiment trend fetch failed:', err.message);
    },
  });

  return {
    points: data ?? [],
    isLoading,
    isError: !!error,
  };
}
