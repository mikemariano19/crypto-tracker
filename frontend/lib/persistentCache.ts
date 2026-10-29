import type { Cache, State } from 'swr';

const STORAGE_KEY = 'crypto-tracker:swr-cache:v1';

// Persisted data older than this is too out of date to show, even briefly.
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

const SAVE_DELAY_MS = 1000;

export type PersistedEntry = {
  data: unknown;
  savedAt: number;
};

export function loadPersistedEntries(): Record<string, PersistedEntry> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};

    const parsed: Record<string, PersistedEntry> = JSON.parse(raw);
    const now = Date.now();

    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([, entry]) =>
          entry?.data !== undefined &&
          typeof entry.savedAt === 'number' &&
          now - entry.savedAt < MAX_AGE_MS
      )
    );
  } catch {
    return {};
  }
}

/**
 * SWR cache provider that mirrors fetched data into localStorage, so a page
 * refresh can show the last known data instantly while SWR revalidates.
 */
export function createPersistentCache() {
  const map = new Map<string, State>();
  // When each key's data was last received (not when it was last written).
  const savedAt = new Map<string, number>();
  const restored = new Map<string, PersistedEntry>();
  let saveTimer: ReturnType<typeof setTimeout> | undefined;

  const save = () => {
    const out: Record<string, PersistedEntry> = {};

    map.forEach((state, key) => {
      // Keys starting with "$" are SWR internals (infinite/subscription).
      // Charts are ~25KB per coin and range, too big for localStorage's quota;
      // search results are throwaway, one entry per keystroke.
      if (
        key.startsWith('$') ||
        key.includes('/chart') ||
        key.includes('/api/search') ||
        state?.data === undefined
      ) return;
      out[key] = { data: state.data, savedAt: savedAt.get(key) ?? Date.now() };
    });

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(out));
    } catch {
      // Storage full or disabled: persistence is best-effort.
    }
  };

  const cache: Cache = {
    keys: () => map.keys(),
    get: (key) => map.get(key),
    delete: (key) => {
      map.delete(key);
      savedAt.delete(key);
    },
    set: (key, value) => {
      const prev = map.get(key);
      const fetched =
        prev?.isValidating === true &&
        value.isValidating === false &&
        value.error === undefined;

      if (value.data !== undefined) {
        const entry = restored.get(key);

        if (fetched) {
          savedAt.set(key, Date.now());
        } else if (value.data !== prev?.data) {
          // Restored data keeps its original age; anything else is new.
          savedAt.set(
            key,
            entry && entry.data === value.data ? entry.savedAt : Date.now()
          );
        }
      }

      map.set(key, value);
      clearTimeout(saveTimer);
      saveTimer = setTimeout(save, SAVE_DELAY_MS);
    },
  };

  const markRestored = (key: string, entry: PersistedEntry) => {
    restored.set(key, entry);
  };

  return { cache, markRestored };
}
