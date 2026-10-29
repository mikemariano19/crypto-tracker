import { useCallback, useSyncExternalStore } from 'react';

/**
 * Whether a media query matches, kept live. The server (and hydration)
 * sees `serverValue`, so only use it for content that renders after mount
 * or where a one-frame switch is fine.
 */
export function useMediaQuery(query: string, serverValue = false): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query]
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => serverValue
  );
}
