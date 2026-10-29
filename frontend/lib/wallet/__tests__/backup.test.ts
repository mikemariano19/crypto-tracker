import { describe, expect, it } from 'vitest';
import * as actions from '@/lib/wallet/actions';
import { backupFileName, readBackup, serializeBackup } from '@/lib/wallet/backup';
import { emptyState, type StoredState } from '@/lib/wallet/schema';

let n = 0;
const clock = { newId: () => `id-${++n}`, now: () => new Date(Date.UTC(2026, 9, 30, 0, 0, n)).toISOString() };

function sample(): StoredState {
  const step = (result: actions.ActionResult) => {
    if (!result.ok) throw new Error(result.error);
    return result.state;
  };

  let state = step(actions.createWallet(emptyState(), { name: 'Binance', note: 'Trading' }, clock));
  state = step(actions.addHolding(state, state.wallets[0].id, { coinId: 'bitcoin', symbol: 'btc', name: 'Bitcoin' }, '0.25', 'add', clock));
  state = step(actions.addHolding(state, state.wallets[0].id, { coinId: 'ethereum', symbol: 'eth', name: 'Ethereum' }, '2.5', 'add', clock));
  state = step(actions.createWallet(state, { name: 'Ledger' }, clock));
  state = step(actions.addHolding(state, state.wallets[1].id, { coinId: 'bitcoin', symbol: 'btc', name: 'Bitcoin' }, '0.1', 'add', clock));
  return step(actions.setCurrency(state, 'php'));
}

describe('backup', () => {
  it('names the file by local date', () => {
    expect(backupFileName(new Date(2026, 0, 5, 23, 59))).toBe('crypto-wallets-2026-01-05.json');
  });

  it('export → clear → import restores everything exactly', () => {
    const original = sample();
    const file = serializeBackup(original);

    // "Clear storage": start from nothing, then import with Replace.
    const read = readBackup(file);
    if (!read.ok) throw new Error(read.error);
    expect(read.preview).toMatchObject({ wallets: 2, coins: 3 });

    const restored = actions.importState(emptyState(), read.preview.state, 'replace', clock);
    expect(restored).toEqual({ ok: true, state: original });
  });

  it('rejects files that are not backups, changing nothing', () => {
    expect(readBackup('not json')).toMatchObject({ ok: false, error: expect.stringMatching(/valid JSON/) });
    expect(readBackup('{"hello":1}')).toMatchObject({ ok: false, error: expect.stringMatching(/isn’t a valid wallet backup/) });
    expect(readBackup(JSON.stringify({ ...sample(), version: 7 }))).toMatchObject({ ok: false });

    const broken = sample();
    broken.wallets[0].holdings[0].amount = '-1';
    expect(readBackup(JSON.stringify(broken))).toMatchObject({ ok: false, error: expect.stringMatching(/isn’t a valid wallet backup/) });
  });

  it('rejects backups carrying secrets', () => {
    const state = sample();
    state.wallets[1].note = 'a'.repeat(64);
    expect(readBackup(JSON.stringify(state))).toMatchObject({ ok: false, error: expect.stringMatching(/seed phrases/) });
  });

  it('rejects oversized files before parsing', () => {
    expect(readBackup(' '.repeat(5 * 1024 * 1024 + 1))).toMatchObject({ ok: false, error: expect.stringMatching(/too large/) });
  });
});
