import { formatFiatPrice, type Money } from '@/lib/money';
import type { PriceAlert } from '@/types/push';

type RateInfo = { per_usd: number };

/**
 * An amount in the currency an alert was set in, which may not be today's
 * display currency. The money helpers take USD, hence the round trip.
 */
export function formatInCurrency(value: number, currency: string, byCode: Map<string, RateInfo>): string {
  const rate = currency === 'usd' ? 1 : byCode.get(currency)?.per_usd;

  if (!rate) return `${value.toLocaleString('en-US')} ${currency.toUpperCase()}`;

  const money: Money = { code: currency, rate };

  return formatFiatPrice(value / rate, money);
}

/** "BTC above ₱4,000,000" */
export function alertLabel(alert: PriceAlert, byCode: Map<string, RateInfo>): string {
  return `${alert.symbol.toUpperCase()} ${alert.direction} ${formatInCurrency(alert.threshold, alert.currency, byCode)}`;
}
