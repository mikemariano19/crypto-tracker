import { useMemo } from 'react';
import useSWR from 'swr';
import { apiUrl, fetchApi } from '@/lib/api';

/** A fiat currency and how many of it one US dollar buys. */
export type FiatCurrency = {
  code: string;
  name: string;
  unit: string;
  per_usd: number;
};

/**
 * Every fiat currency CoinGecko prices in, as rates against USD. One list
 * for all coins; the API refreshes it every 10 minutes.
 */
export function useExchangeRates() {
  const { data, isLoading, error } = useSWR<FiatCurrency[]>(apiUrl('/api/exchange-rates'), fetchApi, {
    refreshInterval: 10 * 60_000,
    revalidateOnFocus: false,
    keepPreviousData: true,
  });

  return useMemo(() => {
    const currencies = data ?? [];
    return {
      currencies,
      byCode: new Map(currencies.map((currency) => [currency.code, currency])),
      isLoading,
      isError: !!error,
    };
  }, [data, error, isLoading]);
}
