import { describe, expect, it } from 'vitest';
import { alertDirection, isIosDevice, parseAmount, urlBase64ToUint8Array } from '@/lib/push';
import { alertLabel, formatInCurrency } from '@/lib/alertFormat';
import type { PriceAlert } from '@/types/push';

describe('urlBase64ToUint8Array', () => {
  it('decodes base64url, with or without padding', () => {
    // "-" and "_" are base64url for "+" and "/".
    expect([...urlBase64ToUint8Array('-_8')]).toEqual([251, 255]);
    expect([...urlBase64ToUint8Array('AQID')]).toEqual([1, 2, 3]);
  });
});

describe('isIosDevice', () => {
  it('spots iPhones, and iPads that claim to be Macs', () => {
    expect(isIosDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 5)).toBe(true);
    expect(isIosDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe(true);
  });

  it('leaves Macs and Android alone', () => {
    expect(isIosDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe(false);
    expect(isIosDevice('Mozilla/5.0 (Linux; Android 15; Pixel 9)', 5)).toBe(false);
  });
});

describe('alertDirection', () => {
  it('waits for a rise above today and a fall below it', () => {
    expect(alertDirection(110, 100)).toBe('above');
    expect(alertDirection(90, 100)).toBe('below');
    expect(alertDirection(100, 100)).toBe('above');
  });
});

describe('parseAmount', () => {
  it('reads amounts written with separators', () => {
    expect(parseAmount('4,000,000')).toBe(4_000_000);
    expect(parseAmount(' 4 000 000 ')).toBe(4_000_000);
    expect(parseAmount('0.000004')).toBe(0.000004);
    expect(parseAmount('.5')).toBe(0.5);
  });

  it('rejects anything that is not a positive number', () => {
    for (const input of ['', '0', '-5', 'abc', '1e5', '1.2.3']) {
      expect(parseAmount(input)).toBeNull();
    }
  });
});

describe('alert formatting', () => {
  const rates = new Map([['php', { per_usd: 58 }]]);

  const alert: PriceAlert = {
    id: 1, coinId: 'bitcoin', symbol: 'btc', direction: 'above', threshold: 4_000_000, currency: 'php', createdAt: null, triggeredAt: null,
  };

  it('shows the amount in the currency the alert was set in', () => {
    expect(formatInCurrency(4_000_000, 'php', rates)).toBe('₱4,000,000.00');
    expect(formatInCurrency(65_000, 'usd', rates)).toBe('$65,000.00');
    expect(alertLabel(alert, rates)).toBe('BTC above ₱4,000,000.00');
  });

  it('still reads when the rate is unknown', () => {
    expect(formatInCurrency(1_500, 'eur', rates)).toBe('1,500 EUR');
  });
});
