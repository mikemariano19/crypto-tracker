import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import useSWR from 'swr';
import { ApiError, apiUrl, fetchApi, postApi } from '@/lib/api';
import {
  browserTimezone,
  contentEncoding,
  createSubscription,
  existingSubscription,
  pushBlocker,
  type PushBlocker,
} from '@/lib/push';
import type { NewPriceAlert, PushKey, PushPrefs, PushState } from '@/types/push';

// A free Render instance can take most of a minute to wake up.
const TIMEOUT_MS = 60_000;

// Starts with "$" so the persistent SWR cache never writes it to storage.
const STATE_KEY = '$push:state';

type Off = { subscribed: false };

export type PushStatus =
  | 'loading'
  | Exclude<PushBlocker, null>
  // The server has no VAPID keys yet.
  | 'unavailable'
  | 'off'
  | 'on';

function subscriptionBody(subscription: PushSubscription) {
  const json = subscription.toJSON();

  return {
    subscription: { endpoint: json.endpoint, keys: json.keys },
    contentEncoding: contentEncoding(),
  };
}

/**
 * The server's view of this browser. A browser the server forgot (say its
 * database was reset) is quietly registered again: permission was already given.
 */
async function loadState(): Promise<PushState | Off> {
  const subscription = await existingSubscription();

  if (!subscription) return { subscribed: false };

  try {
    return await postApi<PushState>(apiUrl('/api/push/state'), TIMEOUT_MS, { endpoint: subscription.endpoint });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return postApi<PushState>(apiUrl('/api/push/subscribe'), TIMEOUT_MS, {
        ...subscriptionBody(subscription),
        prefs: { timezone: browserTimezone() },
      });
    }

    throw error;
  }
}

// The blocker reads browser-only APIs, so the server and first paint say "loading".
const noSubscribe = () => () => {};

/**
 * Web push alerts for this browser: whether they can be on, the server's
 * settings, and the actions. Permission is only ever asked from a click.
 */
export function usePushAlerts(currency: string) {
  const blocker = useSyncExternalStore(noSubscribe, pushBlocker, () => 'unsupported' as const);
  const isClient = useSyncExternalStore(noSubscribe, () => true, () => false);
  const canUse = isClient && blocker === null;

  const { data: key } = useSWR<PushKey>(canUse ? apiUrl('/api/push/key') : null, fetchApi, { revalidateOnFocus: false });
  const { data: state, error: loadError, mutate } = useSWR<PushState | Off>(canUse ? STATE_KEY : null, loadState, {
    revalidateOnFocus: true,
  });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A push arriving while the page is open shows up in the history right away.
  useEffect(() => {
    if (!canUse) return;

    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'push-received') mutate();
    };

    navigator.serviceWorker.addEventListener('message', onMessage);

    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [canUse, mutate]);

  let status: PushStatus;

  if (!isClient) status = 'loading';
  else if (blocker !== null) status = blocker;
  else if (key && !key.enabled) status = 'unavailable';
  else if (!key || (!state && !loadError)) status = 'loading';
  else status = state?.subscribed ? 'on' : 'off';

  /** Runs one action, keeping the last good state if it fails. */
  const run = useCallback(async <T,>(action: () => Promise<T>): Promise<T | null> => {
    setBusy(true);
    setError(null);

    try {
      return await action();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong. Please try again.');

      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  /**
   * Turns alerts on for this browser, asking permission if needed. Null if
   * the person declined, or the server isn't set up.
   */
  const ensureSubscribed = useCallback(async (prefs: Partial<PushPrefs> = {}): Promise<PushSubscription | null> => {
    if (!key?.publicKey) return null;

    const subscription = await createSubscription(key.publicKey);

    if (!subscription) {
      // Declining doesn't block the page, but the browser won't ask again.
      setError(Notification.permission === 'denied'
        ? 'Notifications are blocked for this site. Allow them in your browser settings to get alerts.'
        : 'Notifications were not allowed.');

      return null;
    }

    if (!state?.subscribed) {
      const next = await postApi<PushState>(apiUrl('/api/push/subscribe'), TIMEOUT_MS, {
        ...subscriptionBody(subscription),
        prefs: { timezone: browserTimezone(), currency, ...prefs },
      });

      await mutate(next, { revalidate: false });
    }

    return subscription;
  }, [key, state, currency, mutate]);

  const withEndpoint = useCallback(async (path: string, body: object = {}) => {
    const subscription = await ensureSubscribed();

    if (!subscription) return null;

    const next = await postApi<PushState>(apiUrl(path), TIMEOUT_MS, { endpoint: subscription.endpoint, ...body });
    await mutate(next, { revalidate: false });

    return next;
  }, [ensureSubscribed, mutate]);

  const enable = useCallback(
    (prefs: Partial<PushPrefs> = {}) => run(async () => {
      const subscription = await ensureSubscribed(prefs);

      // Already on: just save the choice that was clicked.
      if (subscription && state?.subscribed && Object.keys(prefs).length > 0) {
        await mutate(await postApi<PushState>(apiUrl('/api/push/prefs'), TIMEOUT_MS, { endpoint: subscription.endpoint, prefs }), { revalidate: false });
      }

      return subscription !== null;
    }),
    [run, ensureSubscribed, state, mutate],
  );

  const addAlert = useCallback(
    (alert: NewPriceAlert) => run(() => withEndpoint('/api/push/alerts', alert)),
    [run, withEndpoint],
  );

  const removeAlert = useCallback(
    (id: number) => run(() => withEndpoint(`/api/push/alerts/${id}/delete`)),
    [run, withEndpoint],
  );

  const updatePrefs = useCallback(
    (prefs: Partial<PushPrefs>) => run(() => withEndpoint('/api/push/prefs', { prefs })),
    [run, withEndpoint],
  );

  /** Turns everything off and tells the server to forget this browser. */
  const disable = useCallback(() => run(async () => {
    const subscription = await existingSubscription();

    if (subscription) {
      await postApi(apiUrl('/api/push/unsubscribe'), TIMEOUT_MS, { endpoint: subscription.endpoint });
      await subscription.unsubscribe();
    }

    await mutate({ subscribed: false }, { revalidate: false });

    return true;
  }), [run, mutate]);

  return {
    status,
    state: state?.subscribed ? state : null,
    busy,
    error: error ?? (loadError instanceof Error ? 'Could not load your alerts. Please try again.' : null),
    enable,
    addAlert,
    removeAlert,
    updatePrefs,
    disable,
  };
}
