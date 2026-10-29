import { describe, expect, it } from 'vitest';
import { addAmounts, looksLikeSecret, parseAmount, walletNameError, walletNoteError } from '@/lib/wallet/validate';

describe('parseAmount', () => {
  it.each([
    ['0.25', '0.25'],
    ['  12 ', '12'],
    ['.5', '0.5'],
    ['007.50', '7.5'],
    ['1,5', '1.5'],
    ['0.000000000000000001', '0.000000000000000001'],
    ['1000000000000000', '1000000000000000'],
  ])('accepts %j as %j', (input, expected) => {
    expect(parseAmount(input)).toEqual({ ok: true, amount: expected });
  });

  it.each([
    [''],
    ['0'],
    ['-1'],
    ['1e5'],
    ['abc'],
    ['1,500'], // could be one thousand five hundred
    ['1,234.5'],
    ['1.2.3'],
    ['.'],
    ['0.0000000000000000001'], // 19 decimals
    ['1000000000000001'],
  ])('rejects %j', (input) => {
    expect(parseAmount(input).ok).toBe(false);
  });
});

describe('addAmounts', () => {
  it('adds exactly, without float error', () => {
    expect(addAmounts('0.1', '0.2')).toBe('0.3');
    expect(addAmounts('0.000000000000000001', '1')).toBe('1.000000000000000001');
  });
});

describe('looksLikeSecret', () => {
  const twelveWords = 'abandon ability able about above absent absorb abstract absurd abuse access accident';

  it('flags 12 and 24 word recovery phrases', () => {
    expect(looksLikeSecret(twelveWords)).toBe(true);
    expect(looksLikeSecret(`${twelveWords} ${twelveWords}`)).toBe(true);
  });

  it('flags private keys', () => {
    expect(looksLikeSecret(`0x${'a1'.repeat(32)}`)).toBe(true);
    expect(looksLikeSecret('b'.repeat(64))).toBe(true);
    expect(looksLikeSecret('5HueCGU8rMjxEXxiPuD5BDku4MkFqeZyd4dZ1jvhTVqvbTLvyTJ')).toBe(true);
    expect(looksLikeSecret('-----BEGIN EC PRIVATE KEY-----')).toBe(true);
  });

  it('leaves normal names and notes alone', () => {
    expect(looksLikeSecret('Binance')).toBe(false);
    expect(looksLikeSecret('Long-term cold storage, do not touch')).toBe(false);
    expect(looksLikeSecret('abandon ability able')).toBe(false); // too few words
    expect(looksLikeSecret('0x' + 'a1'.repeat(20))).toBe(false); // an address, not a key
  });
});

describe('walletNameError', () => {
  const wallets = [{ id: 'a', name: 'Binance' }];

  it('requires a unique, non-empty name', () => {
    expect(walletNameError('  ', wallets)).toMatch(/name/);
    expect(walletNameError('binance', wallets)).toMatch(/already/);
    expect(walletNameError('x'.repeat(41), wallets)).toMatch(/40/);
    expect(walletNameError('Ledger', wallets)).toBeNull();
  });

  it('lets a wallet keep its own name on rename', () => {
    expect(walletNameError('BINANCE', wallets, 'a')).toBeNull();
  });

  it('warns about a pasted seed phrase before complaining about length', () => {
    const phrase = 'abandon ability able about above absent absorb abstract absurd abuse access accident';
    expect(walletNameError(phrase, wallets)).toMatch(/seed phrases/);
  });

  it('rejects secrets in notes', () => {
    expect(walletNoteError('d'.repeat(64))).toMatch(/seed phrases/);
    expect(walletNoteError('x'.repeat(121))).toMatch(/120/);
  });
});
