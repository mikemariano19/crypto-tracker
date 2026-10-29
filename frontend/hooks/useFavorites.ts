import { useCallback, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'crypto-tracker:favorites:v1';
const NONE: string[] = [];

// Favorite coin ids, saved in this browser. One in-memory copy is shared by
// every star button; other tabs are kept in sync through the storage event.
let favorites: string[] | null = null;
const listeners = new Set<() => void>();

function read(): string[] {
  if (favorites) return favorites;

  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    favorites = Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === 'string')
      : [];
  } catch {
    favorites = [];
  }

  return favorites;
}

function write(next: string[]) {
  favorites = next;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked (private mode): favorites last for this visit.
  }

  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      favorites = null; // changed in another tab: re-read
      listener();
    }
  };
  window.addEventListener('storage', onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export function useFavorites() {
  // The server has no localStorage, so it always renders "no favorites".
  const ids = useSyncExternalStore(subscribe, read, () => NONE);

  const toggle = useCallback((id: string) => {
    const current = read();
    write(current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
  }, []);

  const isFavorite = useCallback((id: string) => ids.includes(id), [ids]);

  return { favorites: ids, isFavorite, toggle };
}
