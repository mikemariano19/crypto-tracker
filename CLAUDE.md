# CLAUDE.md

Crypto market tracker: a **Next.js 16** frontend (`frontend/`) over a **Laravel 13** JSON API (`backend/`) that proxies and caches CoinGecko, plus a self-hosted crypto news pipeline. There are no user accounts; personal data (wallets, favorites, theme, currency) lives in the browser's localStorage.

`frontend/CLAUDE.md` also applies: this Next.js version has breaking changes, so read the relevant guide in `frontend/node_modules/next/dist/docs/` before writing Next code.

## Commands

Backend (run in `backend/`, PHP 8.3+):
- `composer setup` — install, copy `.env`, generate key, migrate (SQLite by default)
- `composer dev` — runs `artisan serve` (:8000), `queue:listen`, `pail` logs, Vite and `schedule:work` together
- `composer test` / `php artisan test` — PHPUnit; single test: `php artisan test --filter=NewsPipelineTest`
- `vendor/bin/pint` — PHP formatter
- `php artisan market:warm` — refresh CoinGecko caches before they expire (scheduled every minute)
- `php artisan news:fetch [--sync]` — run the news pipeline (queued unless `--sync`)
- `php artisan news:demo [--clear]` — fill stories with labelled sample sentiment (local env only)
- `php artisan wallets:icons` — download wallet provider icons (scheduled daily)
- `php artisan reverb:start` — WebSocket server on :8080 for realtime events (not started by `composer dev`)

Frontend (run in `frontend/`):
- `npm run dev` — Next dev server on :3000
- `npm run build`, `npm run lint`
- `npm test` — Vitest; single file: `npx vitest run lib/__tests__/money.test.ts`

## Architecture

### Request flow
The browser calls `/api/*` on the Next origin; `next.config.ts` rewrites it to `API_BACKEND_URL` (default `http://localhost:8000`). This means only port 3000 needs exposing for LAN/devtunnel testing. Set `NEXT_PUBLIC_API_URL` only to bypass the rewrite.

All endpoints are GET-only and listed in `backend/routes/api.php`. Every response uses one envelope:
`{ success, source, stale, cached_at, data }` (or `{ success: false, error }`). On the frontend, `lib/api.ts` (`fetchApi` / `fetchApiWithMeta`) unwraps it and throws on failure so SWR keeps the last good data.

### Backend: CoinGecko caching (the core idea)
CoinGecko's free tier is tightly rate-limited, so nothing calls it directly from a controller:
- `App\Support\CoinGecko::get()` — the only HTTP client for CoinGecko. Enforces a per-minute call budget (`services.coingecko.calls_per_minute`; 8 without a key, 25 with `COINGECKO_API_KEY`) and a global block after a 429, throwing `CoinGeckoBusy` instead of hitting the network.
- `App\Support\StaleCache` — stale-while-revalidate keyed cache (`swr:{key}`): serves fresh entries, lets one locked request refresh expired ones, serves the last good copy (kept 7 days, `stale: true`) on failure with a cooldown, and only returns 503 if nothing was ever cached. Also sets ETag + short `Cache-Control`.
- `App\Support\MarketData` — the upstream fetchers, registered in `endpoints()` as `key => [freshSeconds, fetcher]`. These are what `market:warm` pre-refreshes. Responses are trimmed to the fields the frontend renders.
- `App\Support\PriceCache` — per-coin USD/PHP price cache for the wallet tracker (`/api/prices`), batching only stale coins into one `/simple/price` call.

When adding a CoinGecko-backed endpoint: add a fetcher to `MarketData::endpoints()` (or use `StaleCache::respond` with its own key), route it through `CoinGecko::get()`, and return the envelope via StaleCache.

### Backend: news pipeline
`App\Support\News\NewsPipeline::run()` (via the `FetchNews` job, scheduled per `NewsSchedule::cron()`): fetch from sources in `config/news_sources.php` (RSS + CryptoCompare) → dedupe → cluster by title similarity (`TitleSimilarity`) → score with rule-based `RelevanceScorer` (`config/news_keywords.php`) → mark the top clusters `analysis_status = pending`. Models: `NewsBatch`, `NewsArticle`, `NewsCluster`, `NewsSentimentSnapshot`. A finished batch broadcasts `NewsBatchPublished` on the `news` channel. One failing source never fails the batch.

Tuning lives in `config/news.php` (env-driven). The `ai` block (model, token budget) is configuration for sentiment analysis; there is no AI caller in the codebase yet — clusters are only marked pending, and `news:demo` fakes the analysis for UI work.

### Realtime
Laravel Reverb + `laravel-echo`/`pusher-js`. `frontend/lib/echo.ts` reads `NEXT_PUBLIC_REVERB_APP_KEY/HOST/PORT/SCHEME`; in dev it defaults to `ws://127.0.0.1:8080` with key `local`. With no key in a production build, `getEcho()` returns `null` and hooks must skip subscribing. Hooks subscribe to channels (`news`, `crypto-prices`, `top-gainers`, `trending-coins`, `market-stats`, …), but only `news` currently has a backend broadcaster in use; `.env.example` sets `BROADCAST_CONNECTION=log`. `FetchCryptoPrices` / `CryptoPricesUpdated` exist but aren't scheduled or dispatched anywhere. Data hooks fall back to SWR polling.

### Frontend layout
- `app/` — App Router. Pages: `/` (market table), `/trending`, `/top-gainers`, `/news`, `/portfolio`, `/about`. Coin profiles (`/coin/[id]`) render through the `@profile` parallel-route slot, which `app/@header/coin/PageContent.tsx` swaps in for `children` (and handles scroll reset itself). `@header` is the other slot.
- `app/providers.tsx` — SWR config with `lib/persistentCache.ts`, which mirrors SWR data into localStorage (24h max age) and restores it before data hooks mount, so refreshes paint instantly.
- `hooks/` — one SWR hook per API resource (`useCoinPrices`, `useNewsFeed`, …), plus localStorage-backed state hooks (`useDisplayCurrency`, `useFavorites`, `useWalletStore`) built on `useSyncExternalStore` with cross-tab `storage` events.
- `components/coin`, `components/news`, `components/portfolio` — feature components; `components/ui` — shadcn (radix-nova style, `components.json`).
- `lib/wallet/` — portfolio/wallet tracker logic: zod `schema.ts`, `storage.ts` (localStorage with migration; corrupt data is copied aside, never deleted), `actions.ts`, `backup.ts` (import/export), `validate.ts`, `prices.ts`. Heavily unit tested in `lib/wallet/__tests__/`.
- `lib/money.ts` — all currency display. API values are USD; helpers take a USD value plus `Money { code, rate }` (rate from `/api/exchange-rates`). Locale is fixed to `en-US` so server and client render identically. Use `decimal.js` for portfolio arithmetic.
- `lib/theme.ts` — dark mode via a `dark` class on `<html>`, set by an inline head script (`THEME_INIT_SCRIPT`) before hydration; falls back to the OS preference.
- Path alias `@/` → `frontend/`.

## Conventions
- Wrap every `localStorage` access in try/catch; storage may be missing (SSR), blocked or full.
- Backend tests run with an in-memory SQLite DB, `array` cache and `sync` queue (`phpunit.xml`); fake HTTP with `Http::fake()` rather than calling CoinGecko.
- Comments explain *why* (rate limits, hydration order, edge cases) in short plain sentences — keep that style.
- Backend env: `FRONTEND_URLS` (CORS allowlist, comma-separated), `COINGECKO_API_KEY`, `NEWS_*`. Frontend env: `API_BACKEND_URL`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_REVERB_*`.

## Deployment
Frontend on Vercel (root `frontend/`). Backend as one Docker container (`backend/Dockerfile`, e.g. Render free tier): `start.sh` migrates, caches config, runs `queue:work` and `schedule:work` in background loops, then `artisan serve` on `$PORT`. The container filesystem is ephemeral, so production uses Postgres (`DB_URL`, Supabase session pooler) with `CACHE_STORE=database`, not SQLite.
