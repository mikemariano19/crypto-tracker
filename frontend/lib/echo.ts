/* eslint-disable @typescript-eslint/no-explicit-any */
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

// Reverb connection, read at build time. Without a key (e.g. a deploy with no
// Reverb server) realtime is off and the hooks rely on SWR polling alone.
// Dev falls back to a local `php artisan reverb:start`.
const isDev = process.env.NODE_ENV === 'development';
const KEY = process.env.NEXT_PUBLIC_REVERB_APP_KEY ?? (isDev ? 'local' : '');
const HOST = process.env.NEXT_PUBLIC_REVERB_HOST ?? '127.0.0.1';
const PORT = Number(process.env.NEXT_PUBLIC_REVERB_PORT ?? 8080);
const TLS = (process.env.NEXT_PUBLIC_REVERB_SCHEME ?? 'http') === 'https';

let echo: Echo<any> | null = null;

/** The shared Echo client, or null when realtime isn't configured. */
export function getEcho(): Echo<any> | null {
  if (!KEY) return null;
  if (echo) return echo;

  if (typeof window === 'undefined') {
    throw new Error('getEcho() must only be called on the client side');
  }

  (window as any).Pusher = Pusher;

  echo = new Echo<any>({
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

  return echo;
}
