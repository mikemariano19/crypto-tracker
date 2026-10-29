import type Decimal from 'decimal.js';
import { Dec } from '@/lib/wallet/validate';
import type { PriceMap, PriceQuote } from '@/lib/wallet/prices';
import type { Currency, Holding, HoldingSort, Wallet, WalletSort } from '@/lib/wallet/schema';

// Everything the portfolio page derives from wallets + prices: values,
// totals, 24h change, allocation, sorting and search. Pure functions over
// exact decimals (never JS floats for money); components memoize them.

const ZERO = new Dec(0);
const HUNDRED = new Dec(100);

export type HoldingRow = {
  coinId: string;
  symbol: string;
  name: string;
  image?: string;
  amount: string;
  /** Price in the selected currency; null when we have no price. */
  price: Decimal | null;
  /** amount × price; null when we have no price. */
  value: Decimal | null;
  /** 24h change in %, as CoinGecko reports it. */
  change24hPct: number | null;
  /** How much the value moved in 24h, in the selected currency. */
  change24hValue: Decimal | null;
};

export type WalletSummary = {
  wallet: Wallet;
  /** Holdings with values, in the wallet's chosen sort order. */
  rows: HoldingRow[];
  total: Decimal;
  change24h: Decimal;
  /** Holdings left out of the total because they have no price. */
  missingCount: number;
};

export type PortfolioTotals = {
  total: Decimal;
  change24h: Decimal;
  /** null when there's nothing to compare against (empty or brand-new value). */
  change24hPct: Decimal | null;
  /** Distinct coins with no price, excluded from the totals. */
  missingCoins: string[];
};

export type AllocationSlice = {
  /** Coin id, or "other" for everything past the top slices. */
  key: string;
  label: string;
  value: Decimal;
  /** Share of the portfolio, 0–100, rounded so the slices add up to 100. */
  percent: number;
};

/** Quote fields for one currency. */
function pick(quote: PriceQuote | undefined, currency: Currency): { price: number | null; change: number | null } {
  if (!quote) return { price: null, change: null };

  return currency === 'usd'
    ? { price: quote.usd, change: quote.usd_24h_change }
    : { price: quote.php, change: quote.php_24h_change };
}

// String() keeps tiny prices exact-ish ("1.2e-8" parses fine in Decimal).
const toDec = (n: number) => new Dec(String(n));

/**
 * How much a value moved in 24h, given its 24h % change:
 * value − value / (1 + change/100).
 */
export function change24hOf(value: Decimal, changePct: number): Decimal {
  const factor = toDec(changePct).div(HUNDRED).plus(1);
  // A -100% move would divide by zero; the whole value was lost.
  if (factor.lte(0)) return value.neg();
  return value.minus(value.div(factor));
}

export function holdingRow(holding: Holding, quote: PriceQuote | undefined, currency: Currency): HoldingRow {
  const { price, change } = pick(quote, currency);
  const priceDec = price === null ? null : toDec(price);
  const value = priceDec === null ? null : priceDec.times(holding.amount);

  return {
    coinId: holding.coinId,
    symbol: holding.symbol,
    name: holding.name,
    image: holding.image,
    amount: holding.amount,
    price: priceDec,
    value,
    change24hPct: change,
    change24hValue: value !== null && change !== null ? change24hOf(value, change) : null,
  };
}

/**
 * Sorts holding rows. Coins without a price always go last when sorting by
 * value, price or 24h change, whichever direction.
 */
export function sortHoldings(rows: readonly HoldingRow[], sort: HoldingSort): HoldingRow[] {
  const dir = sort.dir === 'asc' ? 1 : -1;

  const numeric = (row: HoldingRow): Decimal | null => {
    switch (sort.by) {
      case 'value':
        return row.value;
      case 'price':
        return row.price;
      case 'change24h':
        return row.change24hPct === null ? null : toDec(row.change24hPct);
      case 'amount':
        return new Dec(row.amount);
      default:
        return null;
    }
  };

  return [...rows].sort((a, b) => {
    if (sort.by === 'name') {
      return dir * a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) || a.coinId.localeCompare(b.coinId);
    }

    const x = numeric(a);
    const y = numeric(b);

    if (x === null || y === null) {
      if (x === y) return a.name.localeCompare(b.name);
      return x === null ? 1 : -1; // missing last, both directions
    }

    return dir * x.comparedTo(y) || a.name.localeCompare(b.name);
  });
}

export function summarizeWallet(wallet: Wallet, prices: PriceMap, currency: Currency): WalletSummary {
  let total = ZERO;
  let change24h = ZERO;
  let missingCount = 0;

  const rows = wallet.holdings.map((holding) => {
    const row = holdingRow(holding, prices[holding.coinId], currency);

    if (row.value === null) {
      missingCount++;
    } else {
      total = total.plus(row.value);
      if (row.change24hValue) change24h = change24h.plus(row.change24hValue);
    }

    return row;
  });

  return { wallet, rows: sortHoldings(rows, wallet.holdingSort), total, change24h, missingCount };
}

export function sortWallets(summaries: readonly WalletSummary[], sort: WalletSort): WalletSummary[] {
  const dir = sort.dir === 'asc' ? 1 : -1;
  const byName = (a: WalletSummary, b: WalletSummary) =>
    a.wallet.name.localeCompare(b.wallet.name, undefined, { sensitivity: 'base' });

  return [...summaries].sort((a, b) => {
    switch (sort.by) {
      case 'name':
        return dir * byName(a, b);
      case 'createdAt':
        return dir * (Date.parse(a.wallet.createdAt) - Date.parse(b.wallet.createdAt)) || byName(a, b);
      default:
        return dir * a.total.comparedTo(b.total) || byName(a, b);
    }
  });
}

/**
 * Totals across wallets. Portfolio 24h % = change ÷ (total − change), i.e.
 * the change relative to where the portfolio stood 24h ago.
 */
export function portfolioTotals(summaries: readonly WalletSummary[]): PortfolioTotals {
  let total = ZERO;
  let change24h = ZERO;
  const missing = new Set<string>();

  for (const summary of summaries) {
    total = total.plus(summary.total);
    change24h = change24h.plus(summary.change24h);

    for (const row of summary.rows) {
      if (row.value === null) missing.add(row.coinId);
    }
  }

  const before = total.minus(change24h);

  return {
    total,
    change24h,
    change24hPct: before.gt(0) ? change24h.div(before).times(HUNDRED) : null,
    missingCoins: [...missing].sort(),
  };
}

/**
 * Share of the portfolio by coin across all wallets: the biggest `top`
 * coins, then everything else as "Other". Percentages are rounded with
 * largest remainders so they always add up to exactly 100.
 */
export function allocation(summaries: readonly WalletSummary[], top = 5): AllocationSlice[] {
  const byCoin = new Map<string, { label: string; value: Decimal }>();

  for (const summary of summaries) {
    for (const row of summary.rows) {
      if (row.value === null || row.value.lte(0)) continue;

      const current = byCoin.get(row.coinId);
      byCoin.set(row.coinId, { label: row.symbol, value: (current?.value ?? ZERO).plus(row.value) });
    }
  }

  const coins = [...byCoin.entries()]
    .map(([key, { label, value }]) => ({ key, label, value }))
    .sort((a, b) => b.value.comparedTo(a.value) || a.label.localeCompare(b.label));

  const slices = coins.slice(0, top);
  const rest = coins.slice(top);

  if (rest.length > 0) {
    slices.push({ key: 'other', label: 'Other', value: rest.reduce((sum, coin) => sum.plus(coin.value), ZERO) });
  }

  const total = slices.reduce((sum, slice) => sum.plus(slice.value), ZERO);
  if (total.lte(0)) return [];

  return withPercents(slices, total);
}

function withPercents(slices: { key: string; label: string; value: Decimal }[], total: Decimal): AllocationSlice[] {
  const exact = slices.map((slice) => slice.value.div(total).times(HUNDRED));
  const floored = exact.map((pct) => pct.floor().toNumber());
  let left = 100 - floored.reduce((sum, pct) => sum + pct, 0);

  // Hand the leftover points to the largest remainders.
  const order = exact
    .map((pct, i) => ({ i, remainder: pct.minus(pct.floor()) }))
    .sort((a, b) => b.remainder.comparedTo(a.remainder) || a.i - b.i);

  for (const { i } of order) {
    if (left <= 0) break;
    floored[i]++;
    left--;
  }

  return slices.map((slice, i) => ({ ...slice, percent: floored[i] }));
}

/** Case-insensitive substring match on wallet name. */
export function filterWallets<T extends { wallet: Pick<Wallet, 'name'> }>(items: readonly T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...items];
  return items.filter((item) => item.wallet.name.toLowerCase().includes(q));
}

/**
 * Splits a name around the first match, for highlighting it.
 * "My Binance", "bin" → ["My ", "Bin", "ance"]; no match → [name, "", ""].
 */
export function splitMatch(name: string, query: string): [string, string, string] {
  const q = query.trim().toLowerCase();
  const at = q ? name.toLowerCase().indexOf(q) : -1;
  if (at === -1) return [name, '', ''];
  return [name.slice(0, at), name.slice(at, at + q.length), name.slice(at + q.length)];
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

const LOCALES: Record<Currency, string> = { usd: 'en-US', php: 'en-PH' };

const formatters = new Map<string, Intl.NumberFormat>();

function formatter(key: string, make: () => Intl.NumberFormat): Intl.NumberFormat {
  let existing = formatters.get(key);
  if (!existing) {
    existing = make();
    formatters.set(key, existing);
  }
  return existing;
}

// Intl formats numeric strings exactly in current browsers (and as a
// Number elsewhere), so decimals are passed as strings, not floats.
type IntlInput = Parameters<Intl.NumberFormat['format']>[0];
const asIntl = (value: Decimal) => value.toFixed() as unknown as IntlInput;

/** A value or total: always 2 decimals. ₱1,234,567.89 / $1,234,567.89 */
export function formatMoney(value: Decimal, currency: Currency): string {
  return formatter(`money-${currency}`, () =>
    new Intl.NumberFormat(LOCALES[currency], {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  ).format(asIntl(value.toDecimalPlaces(2)));
}

/** A coin price: 2 decimals from 1 up, else up to 6 significant digits (₱0.0001234). */
export function formatPrice(price: Decimal, currency: Currency): string {
  if (price.abs().gte(1)) return formatMoney(price, currency);

  return formatter(`price-${currency}`, () =>
    new Intl.NumberFormat(LOCALES[currency], {
      style: 'currency',
      currency: currency.toUpperCase(),
      maximumSignificantDigits: 6,
    })
  ).format(asIntl(price.toSignificantDigits(6)));
}

/** Signed money change: +₱12,345.67 / −$3.10 */
export function formatSignedMoney(value: Decimal, currency: Currency): string {
  const sign = value.isNeg() && !value.isZero() ? '−' : '+';
  return `${sign}${formatMoney(value.abs(), currency)}`;
}

/** Signed percent with 2 decimals: +1.01% / −0.80% */
export function formatSignedPercent(pct: Decimal | number): string {
  const value = typeof pct === 'number' ? toDec(pct) : pct;
  const rounded = value.toDecimalPlaces(2);
  const sign = rounded.isNeg() && !rounded.isZero() ? '−' : '+';
  return `${sign}${rounded.abs().toFixed(2)}%`;
}

export const TABLE_AMOUNT_DECIMALS = 8;

/**
 * A coin amount for tables: grouped, at most 8 decimals, trailing zeros
 * trimmed. Amounts too small to show become "<0.00000001"; the full value
 * belongs in a tooltip.
 */
export function formatAmount(amount: string, maxDecimals = TABLE_AMOUNT_DECIMALS): string {
  const value = new Dec(amount);
  const shown = value.toDecimalPlaces(maxDecimals);

  if (shown.isZero() && !value.isZero()) {
    return `<${new Dec(1).div(new Dec(10).pow(maxDecimals)).toFixed()}`;
  }

  const [whole, fraction] = shown.toFixed().split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fraction ? `${grouped}.${fraction}` : grouped;
}

/** True when formatAmount had to shorten the amount (so show a tooltip). */
export function amountIsShortened(amount: string, maxDecimals = TABLE_AMOUNT_DECIMALS): boolean {
  return !new Dec(amount).toDecimalPlaces(maxDecimals).eq(amount);
}
