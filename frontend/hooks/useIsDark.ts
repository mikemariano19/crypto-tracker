import { useSyncExternalStore } from 'react';

// The <html> "dark" class is the source of truth; the head script and the OS
// setting can both change it, so watch it rather than keeping a copy.
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });
  return () => observer.disconnect();
}

export const isDarkNow = () => document.documentElement.classList.contains('dark');

export function useIsDark(): boolean {
  return useSyncExternalStore(subscribe, isDarkNow, () => false);
}
