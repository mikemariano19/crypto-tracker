import { describe, expect, it } from 'vitest';
import { STORAGE_KEY, emptyState, migrate, parseStoredState } from '@/lib/wallet/schema';
import { CORRUPT_KEY_PREFIX, loadState, parseRaw, saveState } from '@/lib/wallet/storage';

class MemoryStorage {
  items = new Map<string, string>();
  fail: 'none' | 'all' | 'quota' = 'none';

  getItem(key: string) {
    if (this.fail === 'all') throw new Error('blocked');
    return this.items.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    if (this.fail === 'all') throw new Error('blocked');
    if (this.fail === 'quota' && key === STORAGE_KEY) throw new DOMException('full', 'QuotaExceededError');
    this.items.set(key, value);
  }

  removeItem(key: string) {
    if (this.fail === 'all') throw new Error('blocked');
    this.items.delete(key);
  }
}

const valid = {
  ...emptyState(),
  wallets: [
    {
      id: 'w1',
      name: 'Binance',
      createdAt: '2026-10-29T00:00:00.000Z',
      collapsed: false,
      holdingSort: { by: 'value', dir: 'desc' },
      holdings: [
        { coinId: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', amount: '0.25', updatedAt: '2026-10-29T00:00:00.000Z' },
      ],
    },
  ],
};

describe('schema', () => {
  it('accepts valid data and rejects broken data', () => {
    expect(parseStoredState(valid).ok).toBe(true);
    expect(parseStoredState({ ...valid, currency: 'eur' }).ok).toBe(false);
    expect(parseStoredState({ ...valid, wallets: [valid.wallets[0], { ...valid.wallets[0], id: 'w2', name: 'binance' }] }).ok).toBe(false);

    const badAmount = structuredClone(valid);
    badAmount.wallets[0].holdings[0].amount = '1e5';
    expect(parseStoredState(badAmount).ok).toBe(false);
  });

  it('migrate passes current data through and refuses unknown versions', () => {
    expect(migrate(valid)).toBe(valid);
    expect(migrate({ ...valid, version: 99 })).toBeNull();
    expect(migrate([])).toBeNull();
    expect(migrate('hello')).toBeNull();
  });
});

describe('loadState', () => {
  it('starts empty with nothing saved', () => {
    expect(loadState(new MemoryStorage())).toEqual({ state: emptyState(), persistence: 'ok', recoveredFrom: null });
  });

  it('round-trips what saveState wrote', () => {
    const storage = new MemoryStorage();
    const state = parseRaw(JSON.stringify(valid));
    expect(state).not.toBeNull();

    expect(saveState(storage, state!)).toBe('ok');
    expect(loadState(storage).state).toEqual(state);
  });

  it('copies corrupt data aside and starts fresh', () => {
    const storage = new MemoryStorage();
    storage.items.set(STORAGE_KEY, '{not json');

    const result = loadState(storage, new Date(1_700_000_000_000));

    expect(result.state).toEqual(emptyState());
    expect(result.recoveredFrom).toBe(`${CORRUPT_KEY_PREFIX}1700000000000`);
    expect(storage.items.get(`${CORRUPT_KEY_PREFIX}1700000000000`)).toBe('{not json');
    expect(storage.items.has(STORAGE_KEY)).toBe(false);
  });

  it('falls back to memory when storage is blocked or missing', () => {
    const blocked = new MemoryStorage();
    blocked.fail = 'all';

    expect(loadState(blocked).persistence).toBe('memory');
    expect(loadState(undefined).persistence).toBe('memory');
  });

  it('reports a full quota on save', () => {
    const storage = new MemoryStorage();
    storage.fail = 'quota';
    expect(saveState(storage, emptyState())).toBe('full');
  });
});
