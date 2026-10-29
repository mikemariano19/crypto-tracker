import { useMemo } from 'react';
import useSWR from 'swr';
import { apiUrl, fetchApi } from '@/lib/api';
import { useCoinSearch, type SearchResult } from '@/hooks/useCoinSearch';
import { mergeCoinResults, searchCoins } from '@/lib/wallet/coinSearch';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The top 100 coins for the picker. Fetched at most once a day; the app's
 * persistent SWR cache keeps it in localStorage, so it's there instantly.
 */
export function useCoinList() {
  const { data, error, isLoading } = useSWR<SearchResult[]>(apiUrl('/api/coin-list'), fetchApi, {
    revalidateOnFocus: false,
    revalidateIfStale: false,
    dedupingInterval: DAY_MS,
  });

  return { coins: data ?? [], isLoading, isError: Boolean(error) };
}

/**
 * Suggestions for the wallet coin picker: the biggest coins when empty,
 * instant local matches while typing, then the server's wider search.
 */
export function useCoinOptions(input: string, limit = 8) {
  const { coins, isLoading: listLoading } = useCoinList();
  const { results, isSearching, query } = useCoinSearch(input);

  const options = useMemo(() => {
    const local = searchCoins(coins, input, limit);
    return input.trim() ? mergeCoinResults(local, results, limit) : local;
  }, [coins, input, results, limit]);

  return {
    options,
    isLoading: input.trim() ? isSearching && options.length === 0 : listLoading,
    query,
  };
}
