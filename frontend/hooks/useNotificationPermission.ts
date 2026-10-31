import { useSyncExternalStore } from 'react';

export type NotificationState = NotificationPermission | 'unsupported';

const listeners = new Set<() => void>();

function current(): NotificationState {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // The user can also change it from the browser's site settings.
  window.addEventListener('focus', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('focus', listener);
  };
}

/**
 * Asks for permission to show system notifications. Must run from a click:
 * browsers ignore (or auto-deny) prompts that aren't.
 */
export async function requestNotifications(): Promise<NotificationState> {
  if (current() === 'default') {
    try {
      await Notification.requestPermission();
    } catch {
      // Very old Safari only has the callback form; treat as not granted.
    }
    listeners.forEach((listener) => listener());
  }
  return current();
}

export function useNotificationPermission(): NotificationState {
  return useSyncExternalStore(subscribe, current, () => 'unsupported');
}
