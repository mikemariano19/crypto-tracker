import { STORAGE_KEY, emptyState, parseStoredState, type StoredState } from '@/lib/wallet/schema';

// localStorage access for the wallet tracker. Every call is wrapped, since
// storage can be missing (SSR), blocked (private mode) or full.

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export const CORRUPT_KEY_PREFIX = 'cryptoTracker.wallets.corrupt-';

/** How saving behaves right now; the page explains anything but "ok". */
export type Persistence = 'ok' | 'memory' | 'full';

export type LoadResult = {
  state: StoredState;
  persistence: Persistence;
  /** Set when saved data couldn't be read and the tracker started fresh. */
  recoveredFrom: string | null;
};

export function storageAvailable(storage: KeyValueStorage | undefined): storage is KeyValueStorage {
  if (!storage) return false;

  try {
    const probe = `${STORAGE_KEY}.probe`;
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

/**
 * Reads, migrates and validates the saved state. Corrupt data is copied
 * aside (never deleted) and the tracker starts empty, so nothing crashes
 * and nothing is lost for good.
 */
export function loadState(storage: KeyValueStorage | undefined, now = new Date()): LoadResult {
  if (!storageAvailable(storage)) {
    return { state: emptyState(), persistence: 'memory', recoveredFrom: null };
  }

  let raw: string | null;

  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return { state: emptyState(), persistence: 'memory', recoveredFrom: null };
  }

  if (raw === null) {
    return { state: emptyState(), persistence: 'ok', recoveredFrom: null };
  }

  const parsed = parseRaw(raw);
  if (parsed) {
    return { state: parsed, persistence: 'ok', recoveredFrom: null };
  }

  const backupKey = `${CORRUPT_KEY_PREFIX}${now.getTime()}`;

  try {
    storage.setItem(backupKey, raw);
    storage.removeItem(STORAGE_KEY);
  } catch {
    // Can't copy it aside: leave the original untouched and work in memory.
    return { state: emptyState(), persistence: 'memory', recoveredFrom: STORAGE_KEY };
  }

  return { state: emptyState(), persistence: 'ok', recoveredFrom: backupKey };
}

/**
 * The saved state if `raw` is valid, else null. Also used for the
 * cross-tab `storage` event, where a bad value is simply ignored.
 */
export function parseRaw(raw: string): StoredState | null {
  try {
    const result = parseStoredState(JSON.parse(raw));
    return result.ok ? result.state : null;
  } catch {
    return null;
  }
}

export function saveState(storage: KeyValueStorage | undefined, state: StoredState): Persistence {
  if (!storage) return 'memory';

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return 'ok';
  } catch (error) {
    return isQuotaError(error) ? 'full' : 'memory';
  }
}

function isQuotaError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
  );
}
