import { useMemo } from 'react';
import useSWR from 'swr';
import { apiUrl, fetchApi } from '@/lib/api';
import type { WalletProvider } from '@/lib/wallet/providers';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Exchanges and wallets for wallet names and logos. Fetched at most once a
 * day; the app's persistent SWR cache keeps it in localStorage.
 */
export function useWalletProviders() {
  const { data, isLoading } = useSWR<WalletProvider[]>(apiUrl('/api/wallet-providers'), fetchApi, {
    revalidateOnFocus: false,
    revalidateIfStale: false,
    dedupingInterval: DAY_MS,
  });

  const providers = useMemo(() => data ?? [], [data]);
  const byId = useMemo(() => new Map(providers.map((provider) => [provider.id, provider])), [providers]);

  return { providers, byId, isLoading };
}
