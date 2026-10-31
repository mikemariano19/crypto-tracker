import { useMemo, useSyncExternalStore } from 'react';
import {
  ALERTS_STORAGE_KEY,
  createAlert,
  parseAlerts,
  serializeAlerts,
  type AlertHit,
  type AlertInput,
  type PriceAlert,
} from '@/lib/alerts';

// Price alerts, saved in this browser. One in-memory copy is shared by the
// watcher and every alerts UI; other tabs stay in sync through the
// storage event. Same shape as useFavorites.

const NONE: PriceAlert[] = [];

let alerts: PriceAlert[] | null = null;
const listeners = new Set<() => void>();

function storage(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

function read(): PriceAlert[] {
  if (!alerts) alerts = parseAlerts(storage()?.getItem(ALERTS_STORAGE_KEY) ?? null);
  return alerts;
}

function write(next: PriceAlert[]) {
  alerts = next;

  try {
    storage()?.setItem(ALERTS_STORAGE_KEY, serializeAlerts(next));
  } catch {
    // Full or blocked: alerts still work until the tab closes.
  }

  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  const onStorage = (event: StorageEvent) => {
    if (event.key !== ALERTS_STORAGE_KEY) return;
    alerts = parseAlerts(event.newValue);
    listeners.forEach((l) => l());
  };

  window.addEventListener('storage', onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
}

const clock = { now: () => new Date().toISOString(), newId };

const alertActions = {
  /** Returns an error message for the form, or null when saved. */
  addAlert(input: AlertInput): string | null {
    const result = createAlert(read(), input, clock);
    if (!result.ok) return result.error;
    write([...read(), result.alert]);
    return null;
  },
  removeAlert(id: string) {
    write(read().filter((alert) => alert.id !== id));
  },
  rearmAlert(id: string) {
    write(read().map((alert) => (alert.id === id ? { ...alert, triggered: undefined } : alert)));
  },
  clearTriggered() {
    write(read().filter((alert) => !alert.triggered));
  },
  /** Marks hits as fired; returns only those not already marked (e.g. by another tab). */
  markTriggered(hits: readonly AlertHit[]): AlertHit[] {
    const current = new Map(read().map((alert) => [alert.id, alert]));
    const fresh = hits.filter((hit) => current.get(hit.alert.id) && !current.get(hit.alert.id)?.triggered);
    if (fresh.length === 0) return [];

    const at = clock.now();
    const prices = new Map(fresh.map((hit) => [hit.alert.id, hit.price]));
    write(read().map((alert) => (prices.has(alert.id) ? { ...alert, triggered: { at, price: prices.get(alert.id)! } } : alert)));
    return fresh;
  },
};

export type AlertActions = typeof alertActions;

export function useAlerts(): { alerts: PriceAlert[] } & AlertActions {
  // Nothing on the server; saved alerts appear right after hydration.
  const list = useSyncExternalStore(subscribe, read, () => NONE);
  return useMemo(() => ({ alerts: list, ...alertActions }), [list]);
}
