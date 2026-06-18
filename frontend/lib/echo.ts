/* eslint-disable @typescript-eslint/no-explicit-any */
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

let echo: Echo<any> | null = null;

export function getEcho(): Echo<any> {
  if (echo) return echo;

  if (typeof window === 'undefined') {
    throw new Error('getEcho() must only be called on the client side');
  }

  (window as any).Pusher = Pusher;

  echo = new Echo<any>({
    broadcaster: 'pusher',
    key: 'local',
    forceTLS: false,
    disableStats: true,
    client: new Pusher('local', {
      cluster: 'mt1',
      wsHost: '127.0.0.1',
      wsPort: 8080,
      forceTLS: false,
      disableStats: true,
      enabledTransports: ['ws'],
    }),
  });

  return echo;
}