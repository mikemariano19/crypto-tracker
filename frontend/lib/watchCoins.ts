import type { StoredState } from '@/lib/wallet/schema';

// Same cap as the backend (PushSubscription::MAX_WATCH_COINS).
export const MAX_WATCH_COINS = 50;

/**
 * The coins big-move and level alerts watch: wallet coins first (money is
 * on them), then favorites. Only the IDs ever leave the browser, never
 * amounts or wallet names. Sorted so the same set always compares equal.
 */
export function watchCoinIds(favorites: readonly string[], wallets: StoredState | null): string[] {
  const owned = wallets?.wallets.flatMap((wallet) => wallet.holdings.map((holding) => holding.coinId)) ?? [];
  const unique = [...new Set([...owned, ...favorites])].filter((id) => /^[a-z0-9-]{1,100}$/.test(id));

  return unique.slice(0, MAX_WATCH_COINS).sort();
}

export function sameCoins(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;

  const sortedB = [...b].sort();

  return [...a].sort().every((id, i) => id === sortedB[i]);
}
