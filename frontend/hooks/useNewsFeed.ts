import useSWRInfinite from 'swr/infinite';
import { apiUrl, fetchApi } from '@/lib/api';
import type { NewsFilters, NewsPage } from '@/types/news';

export function newsQuery(filters: NewsFilters, cursor: string | null = null): string {
  const params = new URLSearchParams();

  if (filters.label) params.set('label', filters.label);
  if (filters.asset) params.set('asset', filters.asset);
  if (filters.impact) params.set('impact', filters.impact);
  params.set('range', filters.range);
  params.set('sort', filters.sort);
  if (cursor) params.set('cursor', cursor);

  return params.toString();
}

export function useNewsFeed(filters: NewsFilters) {
  const { data, error, isLoading, isValidating, size, setSize, mutate } = useSWRInfinite<NewsPage>(
    (index, previous: NewsPage | null) => {
      if (index > 0 && !previous?.nextCursor) return null;
      return apiUrl(`/api/news?${newsQuery(filters, index === 0 ? null : previous?.nextCursor)}`);
    },
    fetchApi,
    {
      refreshInterval: 15 * 60_000,
      revalidateOnFocus: false,
      revalidateFirstPage: false,
      keepPreviousData: true,
      onError: (err: Error) => {
        console.warn('News feed fetch failed:', err.message);
      },
    },
  );

  const pages = data ?? [];
  const stories = pages.flatMap((page) => page.items);
  const hasMore = pages.at(-1)?.nextCursor != null;
  const isLoadingMore = isValidating && size > pages.length;

  return {
    stories,
    hasMore,
    isLoading,
    isLoadingMore,
    isValidating,
    isError: !!error,
    loadMore: () => setSize(size + 1),
    // Back to the first page with fresh data (used by "N new stories").
    reload: async () => {
      await setSize(1);
      await mutate();
    },
  };
}
