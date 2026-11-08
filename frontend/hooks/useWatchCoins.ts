import { useMemo } from 'react';
import { useFavorites } from '@/hooks/useFavorites';
import { useWalletStore } from '@/hooks/useWalletStore';
import { watchCoinIds } from '@/lib/watchCoins';

/**
 * Coin IDs from this browser's favorites and wallets, for big-move alerts.
 * Null until the wallet store has been read (always null on the server), so
 * an empty list is never sent just because storage wasn't read yet.
 */
export function useWatchCoins(): string[] | null {
  const { favorites } = useFavorites();
  const { state } = useWalletStore();

  return useMemo(() => (state ? watchCoinIds(favorites, state) : null), [favorites, state]);
}
