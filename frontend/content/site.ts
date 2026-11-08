// The few About facts every page needs (the footer). Kept apart from
// content/about.ts so the footer doesn't pull the whole About page and its
// zod schema into every page's JavaScript. about.ts reads these too.
export const SITE = {
  name: 'CryptoTracker',
  lastUpdated: '2026-11-08',
  // CoinGecko's attribution guide: visible text, linked, no implied partnership.
  attribution: { text: 'Data provided by CoinGecko', url: 'https://www.coingecko.com' },
} as const;
