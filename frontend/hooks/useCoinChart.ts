import useSWR, { useSWRConfig } from 'swr';
import { useMemo } from 'react';
import { apiUrl, fetchApi } from '@/lib/api';
import { chartUrlPath, parseChartResponse } from '@/lib/chartSeries';
import type { CandleChartResponse, ChartRange, ChartSeries, LineChartResponse } from '@/types/chart';

const FIVE_MINUTES_MS = 300_000;

export function useCoinChart(coinId: string, range: ChartRange) {
  const key = apiUrl(chartUrlPath(coinId, range));
  const { cache } = useSWRConfig();

  const { data, error, isLoading, isValidating, mutate } = useSWR<CandleChartResponse | LineChartResponse>(
    key,
    fetchApi,
    {
      // Keep the previous range on screen while the next one loads.
      keepPreviousData: true,
      revalidateOnFocus: false,
      // The API refreshes this every 5 minutes, and the live price keeps the
      // chart's end current between refreshes. Longer ranges barely change.
      refreshInterval: range === '1d' ? FIVE_MINUTES_MS : 0,
      dedupingInterval: 30_000,
      onError: (err: Error) => {
        console.warn('Chart fetch failed:', err.message);
      },
    }
  );

  const series = useMemo<ChartSeries | null>(() => (data ? parseChartResponse(data) : null), [data]);

  return {
    series,
    /**
     * `series` is still the previous range's data. SWR keeps handing it back
     * after a failed request too, so isLoading alone can't tell: the old
     * candles must never be shown under the new range's name.
     */
    isPrevious: data !== undefined && cache.get(key)?.data !== data,
    isLoading,
    isValidating,
    isError: !!error,
    retry: () => mutate(),
  };
}
