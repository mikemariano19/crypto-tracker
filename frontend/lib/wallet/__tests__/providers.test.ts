import { describe, expect, it } from 'vitest';
import * as actions from '@/lib/wallet/actions';
import { matchProvider, searchProviders, type WalletProvider } from '@/lib/wallet/providers';
import { emptyState, parseStoredState } from '@/lib/wallet/schema';

const p = (id: string, name: string, kind: WalletProvider['kind'], rank: number | null = null): WalletProvider => ({
  id, name, kind, image: null, rank,
});

const list = [
  p('cg:binance', 'Binance', 'exchange', 3),
  p('cg:binance_us', 'Binance US', 'exchange', 40),
  p('cg:gdax', 'Coinbase Exchange', 'exchange', 2),
  p('cg:coinspro', 'Coins.ph', 'exchange', 90),
  p('cg:kraken', 'Kraken', 'exchange', 1),
  p('app:coinbase-wallet', 'Coinbase Wallet', 'wallet'),
  p('app:ledger', 'Ledger', 'wallet'),
  p('app:pdax', 'PDAX', 'app'),
];

describe('searchProviders', () => {
  it('suggests popular picks before typing', () => {
    expect(searchProviders(list, '').map((x) => x.id).slice(0, 3)).toEqual(['cg:binance', 'cg:coinspro', 'app:pdax']);
  });

  it('ranks name prefixes, then word starts, then anywhere', () => {
    expect(searchProviders(list, 'coin').map((x) => x.name)).toEqual(['Coinbase Exchange', 'Coins.ph', 'Coinbase Wallet']);
    expect(searchProviders(list, 'wallet').map((x) => x.name)).toEqual(['Coinbase Wallet']);
    expect(searchProviders(list, 'ken').map((x) => x.name)).toEqual(['Kraken']);
    expect(searchProviders(list, 'zzz')).toEqual([]);
  });
});

describe('matchProvider', () => {
  it('matches a name that starts with a provider, as whole words', () => {
    expect(matchProvider(list, 'Binance')?.id).toBe('cg:binance');
    expect(matchProvider(list, 'binance savings')?.id).toBe('cg:binance');
    expect(matchProvider(list, 'Binance 2')?.id).toBe('cg:binance');
    // The longest provider name wins.
    expect(matchProvider(list, 'Binance US main')?.id).toBe('cg:binance_us');
  });

  it("doesn't match partial words or unrelated names", () => {
    expect(matchProvider(list, 'Binancex')).toBeNull();
    expect(matchProvider(list, 'Long-term')).toBeNull();
    expect(matchProvider(list, '')).toBeNull();
  });
});

describe('wallet provider field', () => {
  const clock = { newId: () => 'w1', now: () => '2026-10-30T00:00:00.000Z' };

  it('is saved when valid, dropped when malformed', () => {
    const ok = actions.createWallet(emptyState(), { name: 'Binance', provider: 'cg:binance' }, clock);
    expect(ok.ok && ok.state.wallets[0].provider).toBe('cg:binance');

    const bad = actions.createWallet(emptyState(), { name: 'Binance', provider: 'https://evil.example' }, clock);
    expect(bad.ok && bad.state.wallets[0].provider).toBeUndefined();
  });

  it('keeps older saved wallets (no provider) valid', () => {
    const old = {
      ...emptyState(),
      wallets: [{ id: 'w', name: 'Ledger', createdAt: '2026-10-29T00:00:00.000Z', collapsed: false, holdingSort: { by: 'value', dir: 'desc' }, holdings: [] }],
    };
    expect(parseStoredState(old).ok).toBe(true);
  });
});
