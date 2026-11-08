import { useCallback, useSyncExternalStore } from 'react';
import { isInstalledApp, type BeforeInstallPromptEvent } from '@/lib/install';

// The browser fires `beforeinstallprompt` once per page load, often before
// any component mounts, so it's caught at module load and kept here for
// whichever button asks.
let deferred: BeforeInstallPromptEvent | null = null;
let installedNow = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    // Our own button asks instead of the browser's banner, so it isn't asked twice.
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    emit();
  });

  window.addEventListener('appinstalled', () => {
    deferred = null;
    installedNow = true;
    emit();
  });
}

type InstallState = 'installed' | 'prompt' | 'manual';

function read(): InstallState {
  if (installedNow || isInstalledApp()) return 'installed';

  return deferred ? 'prompt' : 'manual';
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  // Opening the installed app switches display mode without a reload.
  let media: MediaQueryList | undefined;
  try {
    media = window.matchMedia('(display-mode: standalone)');
    media.addEventListener('change', listener);
  } catch {}

  return () => {
    listeners.delete(listener);
    media?.removeEventListener('change', listener);
  };
}

/**
 * Whether this page can be installed with one click ("prompt"), only by
 * following the browser's own steps ("manual"), or already is ("installed").
 * Null on the server and first paint.
 */
export function useInstallApp() {
  const state = useSyncExternalStore(subscribe, read, () => null);

  /**
   * Shows the browser's install dialog. "failed" means the browser wouldn't
   * show it, so the caller should fall back to the written steps.
   */
  const install = useCallback(async (): Promise<'accepted' | 'dismissed' | 'failed'> => {
    const event = deferred;

    if (!event) return 'failed';

    try {
      await event.prompt();
    } catch {
      // Not shown (say, no user gesture), so the event is still unused.
      return 'failed';
    }

    // A shown prompt can't be shown again; the browser offers a new one later.
    deferred = null;
    emit();

    const { outcome } = await event.userChoice;

    return outcome;
  }, []);

  return { state, install };
}
