import { describe, expect, it } from 'vitest';
import { USD_MONEY, currencyDigits, formatFiatAxis, formatFiatCompact, formatFiatPrice } from '@/lib/money';

const eur = { code: 'eur', rate: 0.9 };
const jpy = { code: 'jpy', rate: 150 };
const php = { code: 'php', rate: 58 };

describe('money', () => {
  it('keeps the original USD look', () => {
    expect(formatFiatPrice(77539, USD_MONEY)).toBe('$77,539.00');
    expect(formatFiatPrice(0.5, USD_MONEY)).toBe('$0.50');
    expect(formatFiatPrice(0.00001234, USD_MONEY)).toBe('$0.00001234');
    expect(formatFiatCompact(8_950_000_000, USD_MONEY)).toBe('$8.95B');
  });

  it('converts and uses each currency’s symbol and decimals', () => {
    expect(formatFiatPrice(100, eur)).toBe('€90.00');
    expect(formatFiatPrice(100, php)).toBe('₱5,800.00');
    expect(currencyDigits('jpy')).toBe(0);
    expect(formatFiatPrice(100, jpy)).toBe('¥15,000');
    expect(formatFiatCompact(1_000_000_000, jpy)).toBe('¥150B');
  });

  it('shortens axis labels', () => {
    expect(formatFiatAxis(80_490, USD_MONEY)).toBe('$80.49K');
    expect(formatFiatAxis(11.674, USD_MONEY)).toBe('$11.67');
  });

  it('shows a dash for missing values', () => {
    expect(formatFiatPrice(null, eur)).toBe('—');
    expect(formatFiatCompact(undefined, eur)).toBe('—');
  });
});
