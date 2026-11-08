// Installing the app (PWA) across browsers. Chromium browsers (Chrome,
// Brave, Edge, Opera, Samsung Internet) fire `beforeinstallprompt`, so one
// click can install. Safari and Firefox never do, so they get written steps.

export type BrowserName = 'chrome' | 'brave' | 'edge' | 'opera' | 'samsung' | 'firefox' | 'safari' | 'other';

export type InstallGuide =
  /** iPhone or iPad, any browser: Share, then Add to Home Screen. */
  | 'ios'
  /** Safari on a Mac (Sonoma or later): File, then Add to Dock. */
  | 'safari-mac'
  /** Firefox on Android: menu, then Install or Add to Home screen. */
  | 'firefox-android'
  /** Firefox on a computer can't install web apps. */
  | 'firefox-desktop'
  /** Chromium on Android: the browser menu. */
  | 'chromium-android'
  /** Chromium on a computer: the install icon in the address bar, or the menu. */
  | 'chromium-desktop';

/** The Chrome-style install event; not in TypeScript's DOM types yet. */
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export const BROWSER_LABELS: Record<BrowserName, string> = {
  chrome: 'Chrome',
  brave: 'Brave',
  edge: 'Edge',
  opera: 'Opera',
  samsung: 'Samsung Internet',
  firefox: 'Firefox',
  safari: 'Safari',
  other: 'your browser',
};

/** iPads report themselves as Macs, but Macs have no touch screen. */
function isIos(userAgent: string, maxTouchPoints: number): boolean {
  return /iPad|iPhone|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
}

/**
 * Which browser this is. Brave sends Chrome's user agent on purpose, so it's
 * only told apart by `navigator.brave`, passed in as `isBrave`.
 */
export function detectBrowser(userAgent: string, isBrave = false): BrowserName {
  if (isBrave) return 'brave';
  if (/SamsungBrowser\//.test(userAgent)) return 'samsung';
  if (/Edg(A|iOS)?\//.test(userAgent)) return 'edge';
  if (/OPR\/|OPT\/|Opera/.test(userAgent)) return 'opera';
  if (/Firefox\/|FxiOS\//.test(userAgent)) return 'firefox';
  if (/Chrome\/|CriOS\//.test(userAgent)) return 'chrome';
  if (/Safari\//.test(userAgent)) return 'safari';

  return 'other';
}

/** The written steps to show when there's no one-click install. */
export function installGuide(userAgent: string, maxTouchPoints: number, browser: BrowserName): InstallGuide {
  if (isIos(userAgent, maxTouchPoints)) return 'ios';

  const android = /Android/.test(userAgent);

  if (browser === 'firefox') return android ? 'firefox-android' : 'firefox-desktop';
  if (browser === 'safari') return 'safari-mac';

  return android ? 'chromium-android' : 'chromium-desktop';
}

/** Already running as the installed app, so there's nothing to install. */
export function isInstalledApp(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    return window.matchMedia?.('(display-mode: standalone)').matches
      || window.matchMedia?.('(display-mode: window-controls-overlay)').matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  } catch {
    return false;
  }
}

export function currentBrowser(): BrowserName {
  if (typeof navigator === 'undefined') return 'other';

  return detectBrowser(navigator.userAgent, 'brave' in navigator);
}
