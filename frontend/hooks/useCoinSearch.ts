import useSWR from 'swr';
import { useEffect, useState } from 'react';
import { apiUrl, fetchApi } from '@/lib/api';

export type SearchResult = {
  id: string;
  name: string;
  symbol: string;
  image: string | null;
  market_cap_rank: number | null;
};

const DEBOUNCE_MS = 150;

/**
 * Suggestions for what the user is typing. Waits for a short pause between
 * keystrokes, and keeps showing the last results while the next load.
 */
export function useCoinSearch(input: string) {
  const [query, setQuery] = useState(input.trim());

  useEffect(() => {
    const timer = setTimeout(() => setQuery(input.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [input]);

  const { data, isLoading, isValidating } = useSWR<SearchResult[]>(
    query ? apiUrl(`/api/search?q=${encodeURIComponent(query)}`) : null,
    fetchApi,
    {
      keepPreviousData: true,
      revalidateOnFocus: false,
      revalidateIfStale: false,
      dedupingInterval: 60_000,
    }
  );

  return {
    results: query ? data ?? [] : [],
    // True while the typed text hasn't been searched yet.
    isSearching: input.trim() !== query || isLoading || isValidating,
    query,
  };
}
