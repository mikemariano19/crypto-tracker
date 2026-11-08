/* eslint-disable @typescript-eslint/no-explicit-any */
import type Echo from 'laravel-echo';

// Reverb connection, read at build time. Without a key (e.g. a deploy with no
// Reverb server) realtime is off and the hooks rely on SWR polling alone.
// Dev falls back to a local `php artisan reverb:start`.
const isDev = process.env.NODE_ENV === 'development';
const KEY = process.env.NEXT_PUBLIC_REVERB_APP_KEY ?? (isDev ? 'local' : '');
const HOST = process.env.NEXT_PUBLIC_REVERB_HOST ?? '127.0.0.1';
const PORT = Number(process.env.NEXT_PUBLIC_REVERB_PORT ?? 8080);
const TLS = (process.env.NEXT_PUBLIC_REVERB_SCHEME ?? 'http') === 'https';

let echo: Promise<Echo<any>> | null = null;

/**
 * The shared Echo client, or null when realtime isn't configured. Echo and
 * pusher-js are only downloaded here, on first use: without a key they're
 * never loaded, which keeps them out of every page's startup JavaScript.
 */
function loadEcho(): Promise<Echo<any>> | null {
  if (!KEY || typeof window === 'undefined') return null;

  echo ??= Promise.all([import('laravel-echo'), import('pusher-js')]).then(([{ default: EchoClient }, { default: Pusher }]) => {
    (window as any).Pusher = Pusher;

    return new EchoClient<any>({
      broadcaster: 'pusher',
      key: KEY,
      forceTLS: TLS,
      disableStats: true,
      client: new Pusher(KEY, {
        cluster: 'mt1',
        wsHost: HOST,
        wsPort: PORT,
        wssPort: PORT,
        forceTLS: TLS,
        disableStats: true,
        enabledTransports: TLS ? ['wss'] : ['ws'],
      }),
    });
  });

  return echo;
}

/**
 * Listens for one event on a public channel and returns the cleanup for a
 * useEffect. Does nothing when realtime is off. `leave` drops the whole
 * channel on cleanup instead of just this listener.
 */
export function listen<T>(channelName: string, event: string, handler: (payload: T) => void, { leave = false } = {}): () => void {
  const loading = loadEcho();

  if (!loading) return () => {};

  let stopped = false;
  let cleanup: (() => void) | null = null;

  loading
    .then((client) => {
      // The component may have unmounted while Echo was downloading.
      if (stopped) return;

      const channel = client.channel(channelName);
      channel.listen(event, handler);
      cleanup = leave ? () => client.leaveChannel(channelName) : () => channel.stopListening(event);
    })
    .catch((error) => console.warn('Realtime unavailable:', error));

  return () => {
    stopped = true;
    cleanup?.();
  };
}
