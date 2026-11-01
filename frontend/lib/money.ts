// Shows USD amounts from the API in the visitor's chosen currency. Every
// helper takes the USD value and a Money (currency + rate per USD); with
// USD_MONEY the output matches the app's original "$" formatting.

export type Money = {
  /** Lower-case ISO code, e.g. "eur". */
  code: string;
  /** How many of this currency one US dollar buys. */
  rate: number;
};

export const USD_MONEY: Money = { code: 'usd', rate: 1 };

// en-US everywhere so server and browser render the same text.
const LOCALE = 'en-US';

const formatters = new Map<string, Intl.NumberFormat>();

function formatter(code: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${code}|${JSON.stringify(options)}`;
  let existing = formatters.get(key);

  if (!existing) {
    existing = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: code.toUpperCase(), ...options });
    formatters.set(key, existing);
  }

  return existing;
}

/** Decimal places the currency is written with: 2 for most, 0 for JPY or KRW. */
export function currencyDigits(code: string): number {
  return formatter(code, {}).resolvedOptions().maximumFractionDigits ?? 2;
}

function convert(usd: number | null | undefined, money: Money): number | null {
  return usd == null || !Number.isFinite(usd) ? null : usd * money.rate;
}

/**
 * A coin price: the currency's own decimals from 1 up, more below that so
 * small prices keep their digits (€0.00001234).
 */
export function formatFiatPrice(usd: number | null | undefined, money: Money): string {
  const value = convert(usd, money);
  if (value === null) return '—';

  const abs = Math.abs(value);
  const digits = currencyDigits(money.code);
  const [min, max] = abs >= 1 ? [digits, digits] : abs >= 0.01 ? [2, 5] : [5, 8];

  return formatter(money.code, { minimumFractionDigits: min, maximumFractionDigits: max }).format(value);
}

/** Big amounts in short form: $8.95B, ₱520.3B, ¥1.39T. Small ones in full. */
export function formatFiatCompact(usd: number | null | undefined, money: Money): string {
  const value = convert(usd, money);
  if (value === null) return '—';
  if (Math.abs(value) < 1_000) return formatFiatPrice(usd, money);

  return formatter(money.code, { notation: 'compact', maximumFractionDigits: 2 }).format(value);
}

/** Chart axis labels: short, at most 4 significant digits. */
export function formatFiatAxis(usd: number, money: Money): string {
  const value = usd * money.rate;

  return Math.abs(value) >= 1_000
    ? formatter(money.code, { notation: 'compact', maximumFractionDigits: 2 }).format(value)
    : formatter(money.code, { maximumSignificantDigits: 4 }).format(value);
}
