import { useSyncExternalStore } from 'react';
import { useExchangeRates } from '@/hooks/useExchangeRates';
import { USD_MONEY, type Money } from '@/lib/money';

// The currency coin pages show prices in, remembered in this browser.
const STORAGE_KEY = 'cryptoTracker.displayCurrency';
const listeners = new Set<() => void>();

function saved(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? 'usd';
  } catch {
    return 'usd';
  }
}

export function setDisplayCurrency(code: string) {
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    // Storage blocked: the choice lasts until the page reloads.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  // Another tab picked a currency.
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) listener();
  };
  window.addEventListener('storage', onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

/**
 * The visitor's display currency and how to convert USD into it. Until the
 * exchange rates load, `money` stays USD so no number is ever mislabelled.
 */
export function useDisplayCurrency() {
  const { currencies, byCode } = useExchangeRates();
  // USD on the server; the saved choice applies right after hydration.
  const choice = useSyncExternalStore(subscribe, saved, () => 'usd');

  // A saved code the rates no longer list falls back to USD.
  const code = currencies.length === 0 || byCode.has(choice) ? choice : 'usd';
  const info = byCode.get(code);
  const money: Money = code === 'usd' || !info ? USD_MONEY : { code, rate: info.per_usd };

  return { code, money, info, currencies, setCurrency: setDisplayCurrency };
}
