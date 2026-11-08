// Browser side of web push: support checks, the service worker and the push
// subscription. The subscription's endpoint is this browser's only identity
// on the server, so it's sent in POST bodies and never put in a URL.

/** Why alerts can't be turned on here, or null when they can. */
export type PushBlocker = 'unsupported' | 'needs-install' | 'denied' | null;

const SERVICE_WORKER_URL = '/sw.js';

export function isPushSupported(): boolean {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

/** iPads report themselves as Macs, but Macs have no touch screen. */
export function isIosDevice(userAgent: string, maxTouchPoints: number): boolean {
  return /iPad|iPhone|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;

  return window.matchMedia?.('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/**
 * iPhone and iPad only get web push in an app added to the Home Screen,
 * where the push APIs also appear.
 */
export function pushBlocker(): PushBlocker {
  if (typeof window === 'undefined') return 'unsupported';

  const onIos = isIosDevice(navigator.userAgent, navigator.maxTouchPoints ?? 0);

  if (onIos && !isStandalone()) return 'needs-install';
  if (!isPushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';

  return null;
}

/** VAPID keys come base64url-encoded; the Push API wants the raw bytes. */
export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));

  for (let i = 0; i < raw.length; i++) {
    bytes[i] = raw.charCodeAt(i);
  }

  return bytes;
}

export function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.register(SERVICE_WORKER_URL, { scope: '/', updateViaCache: 'none' });
}

/** The existing subscription, without registering or asking anything. */
export async function existingSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;

  const registration = await navigator.serviceWorker.getRegistration('/');

  return (await registration?.pushManager.getSubscription()) ?? null;
}

/**
 * Asks for permission (only ever from a click) and subscribes. Null when the
 * person said no.
 */
export async function createSubscription(publicKey: string): Promise<PushSubscription | null> {
  const permission = await Notification.requestPermission();

  if (permission !== 'granted') return null;

  const registration = await registerServiceWorker();
  await navigator.serviceWorker.ready;

  return (await registration.pushManager.getSubscription())
    ?? registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
}

/**
 * What to tell someone when the browser couldn't set up push after they
 * allowed notifications. Brave turns off the push service by default, so
 * it's the usual cause there, and only a setting fixes it.
 */
export function pushSetupError(browser: string): string {
  if (browser === 'brave') {
    return 'Brave blocks web notifications by default. Open brave://settings/privacy, turn on "Use Google services for push messaging", restart Brave and try again.';
  }

  return 'This browser could not set up notifications. Please try again, or use Chrome or Edge.';
}

/** Older Safari and Chrome only speak the draft encoding. */
export function contentEncoding(): 'aes128gcm' | 'aesgcm' {
  const supported = (PushManager as unknown as { supportedContentEncodings?: string[] }).supportedContentEncodings;

  return !supported || supported.includes('aes128gcm') ? 'aes128gcm' : 'aesgcm';
}

export function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/**
 * Which way the alert points: a target above today's price waits for a rise,
 * one below waits for a fall.
 */
export function alertDirection(threshold: number, currentPrice: number | null): 'above' | 'below' {
  return currentPrice !== null && threshold < currentPrice ? 'below' : 'above';
}

/** "4,000,000", "4000000" and "4 000 000" all mean the same number. */
export function parseAmount(input: string): number | null {
  const cleaned = input.replace(/[\s,]/g, '');

  if (!/^\d*\.?\d+$/.test(cleaned)) return null;

  const value = Number(cleaned);

  return Number.isFinite(value) && value > 0 ? value : null;
}
