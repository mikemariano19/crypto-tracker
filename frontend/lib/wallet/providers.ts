// Exchanges and wallets suggested when naming a wallet (from /api/wallet-providers).

export type WalletProvider = {
  id: string; // "cg:binance" | "app:ledger"
  name: string;
  kind: 'exchange' | 'wallet' | 'app';
  /** Logo URL (CoinGecko, or our own /api for curated wallets); null → letter tile. */
  image: string | null;
  /** CoinGecko trust rank for exchanges; null for curated entries. */
  rank: number | null;
};

export const PROVIDER_KIND_LABELS: Record<WalletProvider['kind'], string> = {
  exchange: 'Exchange',
  wallet: 'Wallet',
  app: 'App',
};

// Suggested before anything is typed: the names most people here will want.
// (CoinGecko ids: Coins.ph is "coinspro", Coinbase is "gdax".)
const POPULAR = ['cg:binance', 'cg:coinspro', 'app:pdax', 'app:gcash', 'app:maya', 'cg:bybit_spot', 'cg:okex', 'cg:gdax', 'app:ledger', 'app:metamask', 'app:trust-wallet'];

const order = (p: WalletProvider) => p.rank ?? Number.MAX_SAFE_INTEGER;

/**
 * Suggestions for what's typed: name starts with it, then a word in the
 * name starts with it, then anywhere; ties by exchange rank. Empty input
 * lists popular picks.
 */
export function searchProviders(list: readonly WalletProvider[], query: string, limit = 8): WalletProvider[] {
  const q = query.trim().toLowerCase();

  if (!q) {
    const popular = POPULAR.map((id) => list.find((p) => p.id === id)).filter((p): p is WalletProvider => Boolean(p));
    return popular.slice(0, limit);
  }

  const tier = (provider: WalletProvider): number | null => {
    const name = provider.name.toLowerCase();
    if (name.startsWith(q)) return 0;
    if (name.split(/[\s.\-()]+/).some((word) => word.startsWith(q))) return 1;
    if (name.includes(q)) return 2;
    return null;
  };

  return list
    .map((provider) => ({ provider, tier: tier(provider) }))
    .filter((entry): entry is { provider: WalletProvider; tier: number } => entry.tier !== null)
    .sort((a, b) => a.tier - b.tier || order(a.provider) - order(b.provider) || a.provider.name.localeCompare(b.provider.name))
    .slice(0, limit)
    .map((entry) => entry.provider);
}

/**
 * The provider a typed name refers to: the longest provider name the wallet
 * name starts with, as whole words. "Binance savings" → Binance; "Long-term"
 * → none. Lets a typed (not picked) name still get its logo.
 */
export function matchProvider(list: readonly WalletProvider[], walletName: string): WalletProvider | null {
  const name = walletName.trim().toLowerCase();
  if (!name) return null;

  let best: WalletProvider | null = null;

  for (const provider of list) {
    const candidate = provider.name.toLowerCase();
    const wholeWord = name === candidate || (name.startsWith(candidate) && /[\s\-_.(]/.test(name.charAt(candidate.length)));

    if (wholeWord && (!best || candidate.length > best.name.length)) best = provider;
  }

  return best;
}
