import { describe, expect, it } from 'vitest';
import { MAX_WATCH_COINS, sameCoins, watchCoinIds } from '@/lib/watchCoins';
import { emptyState, type StoredState } from '@/lib/wallet/schema';

function walletsWith(...coinLists: string[][]): StoredState {
  return {
    ...emptyState(),
    wallets: coinLists.map((coins, i) => ({
      id: `w${i}`,
      name: `Wallet ${i}`,
      holdings: coins.map((coinId) => ({ coinId })),
    })),
  } as unknown as StoredState;
}

describe('watchCoinIds', () => {
  it('merges wallet coins and favorites without repeats, sorted', () => {
    expect(watchCoinIds(['solana', 'bitcoin'], walletsWith(['bitcoin', 'ethereum'], ['ethereum']))).toEqual([
      'bitcoin',
      'ethereum',
      'solana',
    ]);
  });

  it('works before the wallet store has loaded', () => {
    expect(watchCoinIds(['bitcoin'], null)).toEqual(['bitcoin']);
  });

  it('keeps wallet coins first when there are too many', () => {
    const favorites = Array.from({ length: MAX_WATCH_COINS }, (_, i) => `fav-${i}`);
    const ids = watchCoinIds(favorites, walletsWith(['zzz-owned']));

    expect(ids).toHaveLength(MAX_WATCH_COINS);
    expect(ids).toContain('zzz-owned');
  });

  it('drops anything that is not a coin id', () => {
    expect(watchCoinIds(['Bitcoin!', 'bitcoin', ''], null)).toEqual(['bitcoin']);
  });
});

describe('sameCoins', () => {
  it('ignores order', () => {
    expect(sameCoins(['a', 'b'], ['b', 'a'])).toBe(true);
    expect(sameCoins(['a'], ['a', 'b'])).toBe(false);
    expect(sameCoins(['a', 'c'], ['a', 'b'])).toBe(false);
  });
});
