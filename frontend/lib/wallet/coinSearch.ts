import type { SearchResult } from '@/hooks/useCoinSearch';

// Instant matching for the coin picker over the cached top-100 list; the
// server search (top 1,000 + CoinGecko) fills in anything beyond it.

const rank = (coin: SearchResult) => coin.market_cap_rank ?? Number.MAX_SAFE_INTEGER;

/**
 * Exact symbol first, then exact name, then prefix, then anywhere; ties go
 * to the bigger coin. An empty query lists the biggest coins.
 */
export function searchCoins(list: readonly SearchResult[], query: string, limit = 8): SearchResult[] {
  const q = query.trim().toLowerCase();

  if (!q) return [...list].sort((a, b) => rank(a) - rank(b)).slice(0, limit);

  const tier = (coin: SearchResult): number | null => {
    const symbol = coin.symbol.toLowerCase();
    const name = coin.name.toLowerCase();

    if (symbol === q) return 0;
    if (name === q) return 1;
    if (symbol.startsWith(q) || name.startsWith(q)) return 2;
    if (name.includes(q) || symbol.includes(q)) return 3;
    return null;
  };

  return list
    .map((coin) => ({ coin, tier: tier(coin) }))
    .filter((entry): entry is { coin: SearchResult; tier: number } => entry.tier !== null)
    .sort((a, b) => a.tier - b.tier || rank(a.coin) - rank(b.coin))
    .slice(0, limit)
    .map((entry) => entry.coin);
}

/**
 * Local matches first (instant), then server results not already listed.
 */
export function mergeCoinResults(local: readonly SearchResult[], remote: readonly SearchResult[], limit = 8): SearchResult[] {
  const seen = new Set(local.map((coin) => coin.id));
  return [...local, ...remote.filter((coin) => !seen.has(coin.id))].slice(0, limit);
}
