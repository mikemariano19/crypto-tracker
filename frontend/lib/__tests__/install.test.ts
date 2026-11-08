import { describe, expect, it } from 'vitest';
import { detectBrowser, installGuide } from '@/lib/install';

const UA = {
  chromeWindows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  chromeAndroid: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
  opera: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 OPR/115.0.0.0',
  samsung: 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36',
  firefoxWindows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
  firefoxAndroid: 'Mozilla/5.0 (Android 14; Mobile; rv:132.0) Gecko/132.0 Firefox/132.0',
  safariMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.0.0 Mobile/15E148 Safari/604.1',
};

describe('detectBrowser', () => {
  it('tells the common browsers apart', () => {
    expect(detectBrowser(UA.chromeWindows)).toBe('chrome');
    expect(detectBrowser(UA.edge)).toBe('edge');
    expect(detectBrowser(UA.opera)).toBe('opera');
    expect(detectBrowser(UA.samsung)).toBe('samsung');
    expect(detectBrowser(UA.firefoxWindows)).toBe('firefox');
    expect(detectBrowser(UA.safariMac)).toBe('safari');
    expect(detectBrowser(UA.iphoneChrome)).toBe('chrome');
  });

  it('spots Brave only by navigator.brave, since it sends Chrome\'s user agent', () => {
    expect(detectBrowser(UA.chromeWindows, true)).toBe('brave');
  });
});

describe('installGuide', () => {
  it('sends every iPhone browser to Add to Home Screen', () => {
    expect(installGuide(UA.iphoneSafari, 5, 'safari')).toBe('ios');
    expect(installGuide(UA.iphoneChrome, 5, 'chrome')).toBe('ios');
    // An iPad asking for the desktop site looks like a Mac with a touch screen.
    expect(installGuide(UA.safariMac, 5, 'safari')).toBe('ios');
  });

  it('gives Safari on a Mac its Add to Dock steps', () => {
    expect(installGuide(UA.safariMac, 0, 'safari')).toBe('safari-mac');
  });

  it('knows Firefox installs on Android only', () => {
    expect(installGuide(UA.firefoxAndroid, 5, 'firefox')).toBe('firefox-android');
    expect(installGuide(UA.firefoxWindows, 0, 'firefox')).toBe('firefox-desktop');
  });

  it('uses the browser menu steps for Chromium browsers', () => {
    expect(installGuide(UA.chromeAndroid, 5, 'chrome')).toBe('chromium-android');
    expect(installGuide(UA.samsung, 5, 'samsung')).toBe('chromium-android');
    expect(installGuide(UA.chromeWindows, 0, 'brave')).toBe('chromium-desktop');
    expect(installGuide(UA.edge, 0, 'edge')).toBe('chromium-desktop');
  });
});
