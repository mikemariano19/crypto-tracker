import { describe, expect, it } from 'vitest';
import { matchCurrencies } from '@/components/coin/CurrencyPicker';

const c = (code: string, name: string) => ({ code, name, unit: code, per_usd: 1 });
const all = [c('aud', 'Australian Dollar'), c('eur', 'Euro'), c('mxn', 'Mexican Peso'), c('php', 'Philippine Peso'), c('usd', 'US Dollar')];

describe('matchCurrencies', () => {
  it('lists popular currencies first, then the rest by name', () => {
    expect(matchCurrencies(all, '').map((x) => x.code)).toEqual(['usd', 'eur', 'php', 'aud', 'mxn']);
  });

  it('matches codes before names', () => {
    expect(matchCurrencies(all, 'EU').map((x) => x.code)).toEqual(['eur']);
    expect(matchCurrencies(all, 'peso').map((x) => x.code)).toEqual(['mxn', 'php']);
    expect(matchCurrencies(all, 'p').map((x) => x.code)).toEqual(['php', 'mxn']);
  });
});
