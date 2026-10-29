import { useSyncExternalStore } from 'react';

// One shared 30s clock for every "2h ago" label on the news page.
let now = 0;

function subscribe(onTick: () => void) {
  now = Date.now();
  const timer = setInterval(() => {
    now = Date.now();
    onTick();
  }, 30_000);

  return () => clearInterval(timer);
}

/**
 * Current time in ms, or 0 during server render and hydration, so relative
 * times can't cause a hydration mismatch.
 */
export function useNow(): number {
  return useSyncExternalStore(subscribe, () => now, () => 0);
}
