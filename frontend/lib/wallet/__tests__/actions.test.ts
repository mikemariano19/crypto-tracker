import { describe, expect, it } from 'vitest';
import * as actions from '@/lib/wallet/actions';
import { emptyState, storedStateSchema, type StoredState } from '@/lib/wallet/schema';

let ids = 0;
let tick = 0;
const clock = {
  newId: () => `id-${++ids}`,
  now: () => new Date(Date.UTC(2026, 9, 29, 0, 0, tick++)).toISOString(),
};

const btc = { coinId: 'bitcoin', symbol: 'btc', name: 'Bitcoin' };

function unwrap(result: actions.ActionResult): StoredState {
  if (!result.ok) throw new Error(result.error);
  // Every action must leave data that would load again.
  expect(storedStateSchema.safeParse(result.state).success).toBe(true);
  return result.state;
}

function withWallet(name = 'Binance') {
  return unwrap(actions.createWallet(emptyState(), { name }, clock));
}

describe('wallets', () => {
  it('creates, renames and deletes', () => {
    let state = withWallet('  Binance ');
    const id = state.wallets[0].id;

    expect(state.wallets[0]).toMatchObject({ name: 'Binance', collapsed: false, holdings: [] });

    state = unwrap(actions.renameWallet(state, id, { name: 'Ledger', note: ' cold ' }));
    expect(state.wallets[0]).toMatchObject({ name: 'Ledger', note: 'cold' });

    state = unwrap(actions.deleteWallet(state, id));
    expect(state.wallets).toEqual([]);
  });

  it('refuses duplicate names and secrets', () => {
    const state = withWallet('Binance');

    expect(actions.createWallet(state, { name: 'BINANCE' }, clock)).toMatchObject({ ok: false });
    expect(actions.createWallet(state, { name: 'Ledger', note: 'e'.repeat(64) }, clock)).toMatchObject({ ok: false });
  });
});

describe('holdings', () => {
  it('adds to or replaces an existing coin', () => {
    let state = withWallet();
    const id = state.wallets[0].id;

    state = unwrap(actions.addHolding(state, id, btc, '0.25', 'add', clock));
    expect(state.wallets[0].holdings[0]).toMatchObject({ symbol: 'BTC', amount: '0.25' });

    state = unwrap(actions.addHolding(state, id, btc, '0.1', 'add', clock));
    expect(state.wallets[0].holdings).toHaveLength(1);
    expect(state.wallets[0].holdings[0].amount).toBe('0.35');

    state = unwrap(actions.addHolding(state, id, btc, '2', 'replace', clock));
    expect(state.wallets[0].holdings[0].amount).toBe('2');
  });

  it('edits and removes, rejecting bad amounts', () => {
    let state = withWallet();
    const id = state.wallets[0].id;
    state = unwrap(actions.addHolding(state, id, btc, '1', 'add', clock));

    expect(actions.updateHolding(state, id, 'bitcoin', '-3', clock)).toMatchObject({ ok: false });

    state = unwrap(actions.updateHolding(state, id, 'bitcoin', '1,5', clock));
    expect(state.wallets[0].holdings[0].amount).toBe('1.5');

    state = unwrap(actions.removeHolding(state, id, 'bitcoin'));
    expect(state.wallets[0].holdings).toEqual([]);
  });

  it('remembers sort and collapse per wallet', () => {
    let state = withWallet();
    const id = state.wallets[0].id;

    state = unwrap(actions.setHoldingSort(state, id, { by: 'name', dir: 'asc' }));
    state = unwrap(actions.setCollapsed(state, id, true));
    state = unwrap(actions.setWalletSort(state, { by: 'createdAt', dir: 'asc' }));
    state = unwrap(actions.setCurrency(state, 'php'));

    expect(state.wallets[0]).toMatchObject({ collapsed: true, holdingSort: { by: 'name', dir: 'asc' } });
    expect(state).toMatchObject({ currency: 'php', walletSort: { by: 'createdAt', dir: 'asc' } });
  });
});

describe('importState', () => {
  function backup(): StoredState {
    let state = withWallet('Binance');
    state = unwrap(actions.addHolding(state, state.wallets[0].id, btc, '1', 'add', clock));
    return unwrap(actions.createWallet(state, { name: 'Ledger' }, clock));
  }

  it('replaces everything', () => {
    const incoming = backup();
    const state = unwrap(actions.importState(withWallet('Other'), incoming, 'replace', clock));
    expect(state).toEqual(incoming);
  });

  it('merges by wallet name, newest coin amount winning, and is idempotent', () => {
    let mine = withWallet('binance');
    mine = unwrap(actions.addHolding(mine, mine.wallets[0].id, btc, '5', 'add', clock));

    const incoming = backup(); // written later, so its BTC amount is newer

    const once = unwrap(actions.importState(mine, incoming, 'merge', clock));
    const twice = unwrap(actions.importState(once, incoming, 'merge', clock));

    expect(once.wallets.map((w) => w.name)).toEqual(['binance', 'Ledger']);
    expect(once.wallets[0].holdings[0].amount).toBe('1');
    expect(twice.wallets.map((w) => [w.name, w.holdings.length])).toEqual(
      once.wallets.map((w) => [w.name, w.holdings.length])
    );
  });

  it('refuses backups with secrets in them', () => {
    const incoming = backup();
    incoming.wallets[1].note = 'f'.repeat(64);
    expect(actions.importState(emptyState(), incoming, 'replace', clock)).toMatchObject({ ok: false });
  });
});
