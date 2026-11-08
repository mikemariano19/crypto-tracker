# CLAUDE.md

Crypto market tracker: a **Next.js 16** frontend (`frontend/`) over a **Laravel 13** JSON API (`backend/`) that proxies and caches CoinGecko, plus a self-hosted crypto news pipeline. There are no user accounts; personal data (wallets, favorites, theme, currency) lives in the browser's localStorage.

`frontend/CLAUDE.md` also applies: this Next.js version has breaking changes, so read the relevant guide in `frontend/node_modules/next/dist/docs/` before writing Next code.

## Commands

Backend (run in `backend/`, PHP 8.4+ — `composer.lock` pins Symfony 8 even though `composer.json` says `^8.3`):
- `composer setup` — install, copy `.env`, generate key, migrate (SQLite by default)
- `composer dev` — runs `artisan serve` (:8000), `queue:listen` and `schedule:work` together. `pail` and the backend's Vite are left out: pail needs `pcntl`, which Windows lacks, and the API serves no pages. Watch `storage/logs/laravel.log` for logs.
- `composer test` / `php artisan test` — PHPUnit; single test: `php artisan test --filter=NewsPipelineTest`
- `vendor/bin/pint` — PHP formatter
- `php artisan market:warm` — refresh CoinGecko caches before they expire (scheduled every minute)
- `php artisan news:fetch [--sync]` — run the news pipeline (queued unless `--sync`)
- `php artisan news:analyze` — run AI sentiment now on recent stories that have none (spends credits)
- `php artisan news:demo [--clear]` — fill stories with labelled sample sentiment (local env only)
- `php artisan insight:resolve` — score AI price outlooks whose window has passed (scheduled hourly)
- `php artisan wallets:icons` — download wallet provider icons (scheduled daily)
- `php artisan reverb:start` — WebSocket server on :8080 for realtime events (not started by `composer dev`)
- `php artisan push:check` — send due price alerts, coin moves, market and news alerts, and daily briefs (scheduled every 10 minutes, no AI)
- `php artisan push:vapid` — create the VAPID key pair web push needs (on Windows, set `OPENSSL_CONF` to PHP's `extras\ssl\openssl.cnf` first, or EC key creation fails)

Frontend (run in `frontend/`):
- `npm run dev` — Next dev server on :3000
- `npm run build`, `npm run lint`
- `npm test` — Vitest; single file: `npx vitest run lib/__tests__/money.test.ts`

## Architecture

### Request flow
The browser calls `/api/*` on the Next origin; `next.config.ts` rewrites it to `API_BACKEND_URL` (default `http://localhost:8000`). This means only port 3000 needs exposing for LAN/devtunnel testing. Set `NEXT_PUBLIC_API_URL` only to bypass the rewrite.

Endpoints are listed in `backend/routes/api.php` and are GET-only, apart from `POST /api/insight/{id}`, which starts an AI analysis, and the `POST /api/push/*` alert routes. Every response uses one envelope:
`{ success, source, stale, cached_at, data }` (or `{ success: false, error }`). On the frontend, `lib/api.ts` (`fetchApi` / `fetchApiWithMeta`) unwraps it and throws on failure so SWR keeps the last good data.

### Backend: CoinGecko caching (the core idea)
CoinGecko's free tier is tightly rate-limited, so nothing calls it directly from a controller:
- `App\Support\CoinGecko::get()` — the only HTTP client for CoinGecko. Enforces a per-minute call budget (`services.coingecko.calls_per_minute`; 8 without a key, 25 with `COINGECKO_API_KEY`) and a global block after a 429, throwing `CoinGeckoBusy` instead of hitting the network.
- `App\Support\StaleCache` — stale-while-revalidate keyed cache (`swr:{key}`): serves fresh entries, lets one locked request refresh expired ones, serves the last good copy (kept 7 days, `stale: true`) on failure with a cooldown, and only returns 503 if nothing was ever cached. Also sets ETag + short `Cache-Control`.
- `App\Support\MarketData` — the upstream fetchers, registered in `endpoints()` as `key => [freshSeconds, fetcher]`. These are what `market:warm` pre-refreshes. Responses are trimmed to the fields the frontend renders.
- `App\Support\PriceCache` — per-coin USD/PHP price cache for the wallet tracker (`/api/prices`), batching only stale coins into one `/simple/price` call.

When adding a CoinGecko-backed endpoint: add a fetcher to `MarketData::endpoints()` (or use `StaleCache::respond` with its own key), route it through `CoinGecko::get()`, and return the envelope via StaleCache.

### Backend: news pipeline
`App\Support\News\NewsPipeline::run()` (via the `FetchNews` job, scheduled per `NewsSchedule::cron()`): fetch from sources in `config/news_sources.php` (RSS + CryptoCompare) → dedupe → cluster by title similarity (`TitleSimilarity`) → score with rule-based `RelevanceScorer` (`config/news_keywords.php`) → mark the top clusters `analysis_status = pending` → analyze them with `NewsAnalyzer`. Models: `NewsBatch`, `NewsArticle`, `NewsCluster`, `NewsSentimentSnapshot`. A finished batch broadcasts `NewsBatchPublished` on the `news` channel. One failing source never fails the batch.

Tuning lives in `config/news.php` (env-driven). `App\Support\ClaudeJsonClient` is the only place that calls the Claude API (official SDK, structured output), and `ClaudeNewsClient` extends it; `NewsAnalyzer` validates and stores the results and enforces `daily_ai_token_budget`. Without `AI_PROVIDER_API_KEY` the step is skipped and stories stay pending. API errors leave stories pending for the next run; a refused or cut-off answer is split and retried, and a story that still fails is marked `failed`. The AI never supplies URLs, sources or the label (computed from its percentages). `news:demo` fakes the analysis for UI work. When a visitor finds the feed empty, `NewsRefresh` queues one `FetchNews` (10-minute cooldown), the response says `fetching: true`, and `useNewsFeed` polls until the stories arrive; this needs a queue worker running. Tests fake the HTTP layer by passing a PSR-18 client to `ClaudeNewsClient`.

### Backend: AI price insight
On-demand analysis on coin pages (`App\Services\Insight`, `config/insight.php`). Code calculates and the AI only explains: `TechnicalAnalysis` computes zones, EMA, RSI, volume and trend with no I/O; `ClaudeInsightClient` gets a compact summary (never raw candles); `InsightOutlook` rejects any answer that writes a price or names a level outside the computed zones. Zones come from clustered swing points, are at least half an ATR wide, and are scored by how often later candles held or broke them; better-tested levels win over merely closer ones. Levels are USD, and the AI refers to them only by id (R1, S1) so its shared text works for every display currency.

`PriceInsight::run()` is the only path to the AI: a `POST` click on a cache miss, behind a per-key lock and the `insight` rate limit. Results are shared by all visitors (1D 60 min, 7D 6 h, 30D 12 h; 10 min when there's no outlook). `InsightBudget` shares the news token budget as one counter unless `INSIGHT_DAILY_AI_TOKEN_BUDGET` is set. If the AI fails, levels and indicators are still returned with `aiStatus` `unavailable` or `budget_paused`. A run must finish within `insight.deadline_seconds` (25 s), because Next's rewrite proxy drops requests after 30 s: the AI gets the time left with no SDK retries, and a run cut short is not cached. The 7D chart fetches the 30-day history the analysis needs and shows the last 7 days, so a click doesn't wait on CoinGecko.

`OutlookAccuracy` stores each real outlook with its price, and the hourly `insight:resolve` command scores it once its window has passed. The panel shows the share that matched only after `insight.accuracy.min_sample` outlooks, so a handful of lucky calls can't read as a track record. No AI cost.

CoinGecko's free tier shapes this: OHLC only takes `days` of 1, 7, 14, 30, 90, 180, 365 (so 1D has 48 candles and no EMA50, and 7D analyzes 30 days of 4-hour candles); `total_volumes` is a rolling 24h total, not per-candle volume; and a long candle's close can lag, so zones are judged against the live price from `market_chart`.

### Backend: web push alerts
`App\Support\Push`, `config/push.php`, `PushController`. No accounts: a browser's push subscription is its identity, its endpoint travels only in POST bodies, and the server stores just the subscription, settings, the coin IDs and thresholds picked, and the watched coin IDs (`PushSubscription`, `PriceAlert`, `PushNotification`). Endpoints must be on a real push service (`push.allowed_hosts`), since the server POSTs to them. Categories are `price`, `moves`, `market`, `news` and `brief`; only `price` starts on. `PushCheck::run()` (the `push:check` command, or `POST /api/push/check` with `X-Cron-Secret` for a free external scheduler while Render sleeps; a lock stops overlaps) makes one `PriceCache` call for every coin involved and leaves price samples in the cache, from which later runs read 4-hour changes and the previous run's price (ignored if over an hour old). It handles price alerts (one-shot, compared in the currency they were set in using `MarketData::perUsd()`; a price older than 15 minutes never fires one), `CoinMoves` (watched coins, i.e. favorites and wallet coins that the frontend's `WatchCoinsSync` sends as IDs only: 8% in 4h, or crossing past the far edge of a moderate or strong 7D zone computed from cached month candles, with at most 2 chart fetches per run; once per coin and direction per cooldown), market drop or rally (market cap 5% in 24h or BTC 7% in 4h; once per direction per 12 h), `NewsAlerts` (high-impact analyzed stories under 12 h old, each sent once and deep-linked to `/news#story-{id}`, plus a change in the sentiment snapshot's label; no new AI calls, demo data skipped, at most 2 a day) and the daily brief (reuses the latest sentiment snapshot and high-impact story count). `Notifier` applies the rules: category on, quiet hours (the user's own price alerts may be let through), at most 5 a day, a 2-hour cooldown per coin, several hits batched into one message. The brief is exempt from quiet hours and the cap because the user picked its time. A push service saying the subscription expired deletes it. Wording is calm and factual, with no calls to trade (`PushMessages`). `PushSender` is an interface; tests use `FakePushSender`.

### Realtime
Laravel Reverb + `laravel-echo`/`pusher-js`. `frontend/lib/echo.ts` reads `NEXT_PUBLIC_REVERB_APP_KEY/HOST/PORT/SCHEME`; in dev it defaults to `ws://127.0.0.1:8080` with key `local`. Hooks subscribe with `listen(channel, event, handler)`, which returns the effect cleanup; Echo and pusher-js are dynamically imported only when a key is set, so a production build with no key never downloads them. Hooks subscribe to channels (`news`, `crypto-prices`, `top-gainers`, `trending-coins`, `market-stats`, …), but only `news` currently has a backend broadcaster in use; `.env.example` sets `BROADCAST_CONNECTION=log`. `FetchCryptoPrices` / `CryptoPricesUpdated` exist but aren't scheduled or dispatched anywhere. Data hooks fall back to SWR polling.

### Frontend layout
- `app/` — App Router. Pages: `/` (market table), `/trending`, `/top-gainers`, `/news`, `/portfolio`, `/alerts`, `/about`. Coin profiles (`/coin/[id]`) render through the `@profile` parallel-route slot, which `app/@header/coin/PageContent.tsx` swaps in for `children` (and handles scroll reset itself). `@header` is the other slot. The home page is a server component: `MarketHeading` sits outside the table's Suspense boundary so its text (the mobile LCP) is in the static HTML and survives hydration, and the table renders its first 12 rows at once and the rest in a transition to keep Total Blocking Time down.
- `app/providers.tsx` — SWR config with `lib/persistentCache.ts`, which mirrors SWR data into localStorage (24h max age) and restores it before data hooks mount, so refreshes paint instantly.
- `hooks/` — one SWR hook per API resource (`useCoinPrices`, `useNewsFeed`, …), plus localStorage-backed state hooks (`useDisplayCurrency`, `useFavorites`, `useWalletStore`) built on `useSyncExternalStore` with cross-tab `storage` events.
- `components/coin`, `components/news`, `components/portfolio` — feature components; `components/ui` — shadcn (radix-nova style, `components.json`).
- `lib/wallet/` — portfolio/wallet tracker logic: zod `schema.ts`, `storage.ts` (localStorage with migration; corrupt data is copied aside, never deleted), `actions.ts`, `backup.ts` (import/export), `validate.ts`, `prices.ts`. Heavily unit tested in `lib/wallet/__tests__/`.
- `components/coin/CryptoChart.tsx` — the coin price chart: every range is candles from `/api/coins/{id}/chart` (`ChartData`): 1D 30-min, 7D and 30D 4-hour, 90D daily candles built from hourly `market_chart` prices (CoinGecko's 90-day OHLC is 4-day), 1Y 4-day. 1D, 7D and 30D can be analyzed. `InsightChart.tsx` wraps Lightweight Charts and must stay client-only (`next/dynamic` with `ssr: false`). It plots prices in the display currency so the scale picks round steps, and keeps the library's attribution logo, which its license requires. Pan and zoom stay off so the chart never takes over page scrolling. "AI Analyze" appears on 1D, 7D and 30D for allowed coins; a stored result only shows after a click, and `useRunInsight` is the only frontend path that can spend AI credits. RSI and volume are chart panes rather than separate charts, so their time axes can't drift, and `snapToCandles` keeps indicator times on the candles.
- PWA and alerts: `app/manifest.ts`, icons from `lib/pwaIcon.tsx` (`app/apple-icon.tsx`, `/pwa-icon/[size]`), and `public/sw.js`, which only shows pushes and opens same-origin deep links (no offline caching, so prices are never served old). `lib/push.ts` has the browser side; `hooks/usePushAlerts.ts` holds the server state under the `$push:state` SWR key so it's never persisted. Permission is only asked from a click (the bell in `components/alerts/AlertButton.tsx` on coin pages and wallet rows, or a switch on `/alerts`). iPhone and iPad only get push from the Home Screen app, so they see an install guide instead. Brave turns its push service off by default, so a failed subscribe there names the setting to switch on (`pushSetupError`). The header's install button (`components/install/`) shows on phones and tablets only (under `lg` or a coarse pointer): Chromium browsers get their one-click prompt (`hooks/useInstallApp.ts` catches `beforeinstallprompt` at module load), and Safari, Firefox or a refused prompt get written steps per browser (`lib/install.ts`).
- `lib/money.ts` — all currency display. API values are USD; helpers take a USD value plus `Money { code, rate }` (rate from `/api/exchange-rates`). Locale is fixed to `en-US` so server and client render identically. Use `decimal.js` for portfolio arithmetic.
- `lib/theme.ts` — dark mode via a `dark` class on `<html>`, set by an inline head script (`THEME_INIT_SCRIPT`) before hydration; falls back to the OS preference.
- Path alias `@/` → `frontend/`.

## Conventions
- Wrap every `localStorage` access in try/catch; storage may be missing (SSR), blocked or full.
- Backend tests run with an in-memory SQLite DB, `array` cache and `sync` queue (`phpunit.xml`); fake HTTP with `Http::fake()` rather than calling CoinGecko.
- Comments explain *why* (rate limits, hydration order, edge cases) in short plain sentences — keep that style.
- Backend env: `FRONTEND_URLS` (CORS allowlist, comma-separated), `COINGECKO_API_KEY`, `NEWS_*`, `AI_*`, `VAPID_*` and `PUSH_CRON_SECRET` (push is off without VAPID keys). Frontend env: `API_BACKEND_URL`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_REVERB_*`.

## Deployment
Frontend on Vercel (root `frontend/`). Backend as one Docker container (`backend/Dockerfile`, e.g. Render free tier): `start.sh` migrates, caches config, runs `queue:work` and `schedule:work` in background loops, then `artisan serve` on `$PORT`. The container filesystem is ephemeral, so production uses Postgres (`DB_URL`, Supabase session pooler) with `CACHE_STORE=database`, not SQLite.
