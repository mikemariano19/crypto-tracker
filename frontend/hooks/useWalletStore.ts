import { useMemo, useSyncExternalStore } from 'react';
import * as actions from '@/lib/wallet/actions';
import type { ActionResult, AddMode, CoinPick, WalletInput } from '@/lib/wallet/actions';
import { STORAGE_KEY, type Currency, type HoldingSort, type StoredState, type WalletSort } from '@/lib/wallet/schema';
import { loadState, parseRaw, saveState, type Persistence } from '@/lib/wallet/storage';

// The wallet tracker's state, saved in this browser only. One in-memory copy
// is shared by every component; other tabs stay in sync through the
// `storage` event. Same shape as useFavorites, with validation on top.

const SAVE_DELAY_MS = 300;

export type WalletSnapshot = {
  /** null until the browser has read storage (always null on the server). */
  state: StoredState | null;
  persistence: Persistence;
  /** Where unreadable saved data was copied to, for a one-time notice. */
  recoveredFrom: string | null;
};

const SERVER_SNAPSHOT: WalletSnapshot = { state: null, persistence: 'ok', recoveredFrom: null };

let snapshot: WalletSnapshot | null = null;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function browserStorage(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined; // some browsers throw just for touching it when blocked
  }
}

function read(): WalletSnapshot {
  if (!snapshot) {
    const loaded = loadState(browserStorage());
    snapshot = { state: loaded.state, persistence: loaded.persistence, recoveredFrom: loaded.recoveredFrom };
  }
  return snapshot;
}

function emit(next: WalletSnapshot) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

function flush() {
  clearTimeout(saveTimer);
  saveTimer = undefined;

  const current = read();
  // In memory-only mode the original data may still be in storage; leave it.
  if (!current.state || current.persistence === 'memory') return;

  const persistence = saveState(browserStorage(), current.state);
  if (persistence !== current.persistence) emit({ ...current, persistence });
}

function commit(result: ActionResult): string | null {
  if (!result.ok) return result.error;

  emit({ ...read(), state: result.state });

  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, SAVE_DELAY_MS);

  return null;
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY || event.newValue === null) return;

    const incoming = parseRaw(event.newValue);
    if (!incoming) return; // another tab wrote something we can't read: keep ours

    // Their write is newer than anything we haven't saved yet.
    clearTimeout(saveTimer);
    saveTimer = undefined;
    emit({ ...read(), state: incoming });
  };

  // Don't lose the last ≤300 ms of edits when the tab closes.
  const onHide = () => {
    if (saveTimer) flush();
  };

  window.addEventListener('storage', onStorage);
  window.addEventListener('pagehide', onHide);

  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
    window.removeEventListener('pagehide', onHide);
  };
}

/** crypto.randomUUID needs HTTPS or localhost; LAN testing over http doesn't have it. */
function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();

  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

const clock = { now: () => new Date().toISOString(), newId };

/** Current state for actions; they only run in the browser, after load. */
function current(): StoredState {
  const state = read().state;
  if (!state) throw new Error('Wallet store used before it loaded');
  return state;
}

// Each action returns an error message for the form, or null on success.
const walletActions = {
  createWallet: (input: WalletInput) => commit(actions.createWallet(current(), input, clock)),
  renameWallet: (walletId: string, input: WalletInput) =>
    commit(actions.renameWallet(current(), walletId, input)),
  deleteWallet: (walletId: string) => commit(actions.deleteWallet(current(), walletId)),
  setCollapsed: (walletId: string, collapsed: boolean) => commit(actions.setCollapsed(current(), walletId, collapsed)),
  addHolding: (walletId: string, coin: CoinPick, amount: string, mode: AddMode = 'add') =>
    commit(actions.addHolding(current(), walletId, coin, amount, mode, clock)),
  updateHolding: (walletId: string, coinId: string, amount: string) =>
    commit(actions.updateHolding(current(), walletId, coinId, amount, clock)),
  removeHolding: (walletId: string, coinId: string) => commit(actions.removeHolding(current(), walletId, coinId)),
  setCurrency: (currency: Currency) => commit(actions.setCurrency(current(), currency)),
  setWalletSort: (sort: WalletSort) => commit(actions.setWalletSort(current(), sort)),
  setHoldingSort: (walletId: string, sort: HoldingSort) => commit(actions.setHoldingSort(current(), walletId, sort)),
  importState: (incoming: StoredState, mode: 'replace' | 'merge') =>
    commit(actions.importState(current(), incoming, mode, clock)),
  exportState: (): StoredState => current(),
  dismissRecovery: () => emit({ ...read(), recoveredFrom: null }),
};

export type WalletActions = typeof walletActions;

export function useWalletStore(): WalletSnapshot & WalletActions {
  // The server has no localStorage, so it renders the loading skeleton; the
  // client swaps in saved data right after hydration, without a mismatch.
  const snap = useSyncExternalStore(subscribe, read, () => SERVER_SNAPSHOT);

  return useMemo(() => ({ ...snap, ...walletActions }), [snap]);
}
