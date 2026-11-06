import { useCallback, useSyncExternalStore } from 'react';
import type { InsightToggles } from '@/types/insight';

// Which indicators this visitor likes to see, remembered in this browser.
const STORAGE_KEY = 'cryptoTracker.insightToggles';

const DEFAULTS: InsightToggles = { ma: true, rsi: true, volume: true, sr: true };

const listeners = new Set<() => void>();

// useSyncExternalStore needs the same object back until something changes.
let cached: { raw: string | null; value: InsightToggles } = { raw: null, value: DEFAULTS };

function read(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function snapshot(): InsightToggles {
  const raw = read();

  if (raw === cached.raw) return cached.value;

  let value = DEFAULTS;

  try {
    value = raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    // A corrupt preference isn't worth anything: fall back to the defaults.
  }

  cached = { raw, value };

  return value;
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) listener();
  };
  window.addEventListener('storage', onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export function useInsightToggles() {
  const toggles = useSyncExternalStore(subscribe, snapshot, () => DEFAULTS);

  const toggle = useCallback((key: keyof InsightToggles) => {
    const next = { ...snapshot(), [key]: !snapshot()[key] };
    const raw = JSON.stringify(next);

    // Kept here too, so the change still lasts this visit if storage is blocked.
    cached = { raw, value: next };

    try {
      localStorage.setItem(STORAGE_KEY, raw);
    } catch {
      cached = { raw: read(), value: next };
    }

    listeners.forEach((listener) => listener());
  }, []);

  return { toggles, toggle };
}
