import { describe, expect, it } from 'vitest';
import {
  allocation,
  amountIsShortened,
  change24hOf,
  filterWallets,
  formatAmount,
  formatMoney,
  formatPrice,
  formatSignedMoney,
  formatSignedPercent,
  holdingRow,
  portfolioTotals,
  sortHoldings,
  sortWallets,
  splitMatch,
  summarizeWallet,
  type HoldingRow,
} from '@/lib/portfolio';
import type { PriceMap, PriceQuote } from '@/lib/wallet/prices';
import type { Holding, Wallet } from '@/lib/wallet/schema';
import { Dec } from '@/lib/wallet/validate';

const quote = (usd: number | null, change: number | null = 0, php = usd === null ? null : usd * 58): PriceQuote => ({
  usd,
  php,
  usd_24h_change: change,
  php_24h_change: change,
  last_updated_at: 1,
});

const holding = (coinId: string, amount: string, name = coinId, symbol = coinId.slice(0, 3).toUpperCase()): Holding => ({
  coinId,
  symbol,
  name,
  amount,
  updatedAt: '2026-10-29T00:00:00.000Z',
});

const wallet = (name: string, holdings: Holding[], createdAt = '2026-10-29T00:00:00.000Z'): Wallet => ({
  id: name,
  name,
  createdAt,
  collapsed: false,
  holdingSort: { by: 'value', dir: 'desc' },
  holdings,
});

describe('values', () => {
  it('multiplies exactly, without float error', () => {
    const row = holdingRow(holding('x', '0.1'), quote(0.2), 'usd');
    expect(row.value?.toFixed()).toBe('0.02');

    const big = holdingRow(holding('bitcoin', '0.25'), quote(81_412.37), 'usd');
    expect(big.value?.toFixed()).toBe('20353.0925');
  });

  it('uses the selected currency', () => {
    const row = holdingRow(holding('bitcoin', '2'), quote(100, 1, 5800), 'php');
    expect(row.price?.toFixed()).toBe('5800');
    expect(row.value?.toFixed()).toBe('11600');
  });

  it('has no value without a price', () => {
    expect(holdingRow(holding('x', '1'), undefined, 'usd').value).toBeNull();
    expect(holdingRow(holding('x', '1'), quote(null), 'usd').value).toBeNull();
  });

  it('computes 24h change as value − value / (1 + pct/100)', () => {
    // 110 today after +10%: it was 100, so it moved +10.
    expect(change24hOf(new Dec(110), 10).toFixed()).toBe('10');
    expect(change24hOf(new Dec(90), -10).toFixed(2)).toBe('-10.00');
    expect(change24hOf(new Dec(5), -100).toFixed()).toBe('-5');
  });
});

describe('wallet and portfolio totals', () => {
  const prices: PriceMap = {
    bitcoin: quote(100, 10), // value 110 → +10
    ethereum: quote(10, -10), // value 90 → −10
  };

  const a = wallet('Binance', [holding('bitcoin', '1.1'), holding('ethereum', '9'), holding('mystery', '5')]);
  const b = wallet('Ledger', [holding('bitcoin', '1.1')]);

  it('sums a wallet, leaving out coins with no price', () => {
    const summary = summarizeWallet(a, prices, 'usd');

    expect(summary.total.toFixed()).toBe('200');
    expect(summary.change24h.toFixed(6)).toBe('0.000000');
    expect(summary.missingCount).toBe(1);
    expect(summary.rows.map((r) => r.coinId)).toEqual(['bitcoin', 'ethereum', 'mystery']);
  });

  it('adds up the portfolio with its 24h %', () => {
    const totals = portfolioTotals([summarizeWallet(a, prices, 'usd'), summarizeWallet(b, prices, 'usd')]);

    expect(totals.total.toFixed()).toBe('310');
    expect(totals.change24h.toFixed(6)).toBe('10.000000');
    // 10 ÷ (310 − 10) = 3.33%
    expect(totals.change24hPct?.toFixed(2)).toBe('3.33');
    expect(totals.missingCoins).toEqual(['mystery']);
  });

  it('has no 24h % for an empty portfolio', () => {
    expect(portfolioTotals([]).change24hPct).toBeNull();
  });
});

describe('sorting', () => {
  const rows: HoldingRow[] = [
    holdingRow(holding('bitcoin', '0.5', 'Bitcoin'), quote(100, 2), 'usd'), // 50
    holdingRow(holding('ethereum', '10', 'Ethereum'), quote(10, -1), 'usd'), // 100
    holdingRow(holding('mystery', '1000', 'Mystery'), undefined, 'usd'),
    holdingRow(holding('cardano', '200', 'cardano'), quote(0.3, 5), 'usd'), // 60
  ];

  const ids = (sorted: HoldingRow[]) => sorted.map((r) => r.coinId);

  it('sorts by value both ways, missing prices last', () => {
    expect(ids(sortHoldings(rows, { by: 'value', dir: 'desc' }))).toEqual(['ethereum', 'cardano', 'bitcoin', 'mystery']);
    expect(ids(sortHoldings(rows, { by: 'value', dir: 'asc' }))).toEqual(['bitcoin', 'cardano', 'ethereum', 'mystery']);
  });

  it('sorts by price and 24h change, missing last', () => {
    expect(ids(sortHoldings(rows, { by: 'price', dir: 'asc' }))).toEqual(['cardano', 'ethereum', 'bitcoin', 'mystery']);
    expect(ids(sortHoldings(rows, { by: 'change24h', dir: 'desc' }))).toEqual(['cardano', 'bitcoin', 'ethereum', 'mystery']);
  });

  it('sorts by amount and by name (case-insensitive)', () => {
    expect(ids(sortHoldings(rows, { by: 'amount', dir: 'desc' }))).toEqual(['mystery', 'cardano', 'ethereum', 'bitcoin']);
    expect(ids(sortHoldings(rows, { by: 'name', dir: 'asc' }))).toEqual(['bitcoin', 'cardano', 'ethereum', 'mystery']);
  });

  it('sorts wallets by total, name and creation date', () => {
    const prices: PriceMap = { bitcoin: quote(100) };
    const summaries = [
      summarizeWallet(wallet('beta', [holding('bitcoin', '1')], '2026-01-02T00:00:00.000Z'), prices, 'usd'),
      summarizeWallet(wallet('Alpha', [holding('bitcoin', '3')], '2026-01-03T00:00:00.000Z'), prices, 'usd'),
      summarizeWallet(wallet('gamma', [holding('bitcoin', '2')], '2026-01-01T00:00:00.000Z'), prices, 'usd'),
    ];
    const names = (s: typeof summaries) => s.map((x) => x.wallet.name);

    expect(names(sortWallets(summaries, { by: 'value', dir: 'desc' }))).toEqual(['Alpha', 'gamma', 'beta']);
    expect(names(sortWallets(summaries, { by: 'name', dir: 'asc' }))).toEqual(['Alpha', 'beta', 'gamma']);
    expect(names(sortWallets(summaries, { by: 'createdAt', dir: 'asc' }))).toEqual(['gamma', 'beta', 'Alpha']);
  });
});

describe('search', () => {
  const items = ['Binance', 'Ledger', 'My binance sub'].map((name) => ({ wallet: { name } }));

  it('filters by name, case-insensitive substring', () => {
    expect(filterWallets(items, 'BIN').map((i) => i.wallet.name)).toEqual(['Binance', 'My binance sub']);
    expect(filterWallets(items, '  ')).toHaveLength(3);
    expect(filterWallets(items, 'kraken')).toEqual([]);
  });

  it('splits out the match for highlighting', () => {
    expect(splitMatch('My Binance', 'bin')).toEqual(['My ', 'Bin', 'ance']);
    expect(splitMatch('Ledger', 'x')).toEqual(['Ledger', '', '']);
  });
});

describe('allocation', () => {
  it('groups coins across wallets, top N plus Other, adding up to 100', () => {
    const prices: PriceMap = Object.fromEntries(['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id) => [id, quote(1)]));
    const summaries = [
      summarizeWallet(wallet('one', [holding('a', '30'), holding('b', '20'), holding('c', '10')]), prices, 'usd'),
      summarizeWallet(wallet('two', [holding('a', '10'), holding('d', '10'), holding('e', '10'), holding('f', '5'), holding('g', '5')]), prices, 'usd'),
    ];

    const slices = allocation(summaries);

    expect(slices.map((s) => s.key)).toEqual(['a', 'b', 'c', 'd', 'e', 'other']);
    expect(slices[0].value.toFixed()).toBe('40');
    expect(slices.at(-1)?.value.toFixed()).toBe('10');
    expect(slices.reduce((sum, s) => sum + s.percent, 0)).toBe(100);
  });

  it('rounds thirds to 34/33/33', () => {
    const prices: PriceMap = { a: quote(1), b: quote(1), c: quote(1) };
    const summaries = [summarizeWallet(wallet('w', [holding('a', '1'), holding('b', '1'), holding('c', '1')]), prices, 'usd')];

    expect(allocation(summaries).map((s) => s.percent)).toEqual([34, 33, 33]);
  });

  it('is empty without priced coins', () => {
    expect(allocation([summarizeWallet(wallet('w', [holding('x', '1')]), {}, 'usd')])).toEqual([]);
  });
});

describe('formatting', () => {
  it('formats PHP and USD money with 2 decimals', () => {
    expect(formatMoney(new Dec('1234567.891'), 'php')).toBe('₱1,234,567.89');
    expect(formatMoney(new Dec('21204.1'), 'usd')).toBe('$21,204.10');
  });

  it('keeps 6 significant digits for prices under 1', () => {
    expect(formatPrice(new Dec('0.0001234'), 'php')).toBe('₱0.0001234');
    expect(formatPrice(new Dec('0.123456789'), 'usd')).toBe('$0.123457');
    expect(formatPrice(new Dec('81412.375'), 'usd')).toBe('$81,412.38');
  });

  it('signs changes', () => {
    expect(formatSignedMoney(new Dec('12345.678'), 'php')).toBe('+₱12,345.68');
    expect(formatSignedMoney(new Dec('-3.1'), 'usd')).toBe('−$3.10');
    expect(formatSignedPercent(1.0149)).toBe('+1.01%');
    expect(formatSignedPercent(new Dec('-0.8'))).toBe('−0.80%');
    expect(formatSignedPercent(-0.001)).toBe('+0.00%');
  });

  it('shows amounts grouped, trimmed, at most 8 decimals', () => {
    expect(formatAmount('1234567.25')).toBe('1,234,567.25');
    expect(formatAmount('0.123456789')).toBe('0.12345679');
    expect(formatAmount('0.000000000001')).toBe('<0.00000001');
    expect(amountIsShortened('0.123456789')).toBe(true);
    expect(amountIsShortened('0.25')).toBe(false);
  });
});
