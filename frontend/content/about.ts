import { z } from 'zod';
import { SITE } from '@/content/site';

// Everything the About page says lives here, so it can be edited without
// touching components. The schema below is checked at build time: a
// missing field fails the build, and any text still in [brackets] is
// reported as an unfilled placeholder (see lib/about.ts).

const link = z.string().refine((href) => href.startsWith('/') || /^https?:\/\//.test(href) || href.startsWith('mailto:') || /^\[.*\]$/.test(href), {
  message: 'must be a site path (/…), http(s) URL, mailto: link, or a [placeholder]',
});

export const aboutSchema = z.object({
  app: z.object({
    name: z.string().min(1),
    tagline: z.string().min(1).max(160),
    description: z.string().min(1),
    badge: z.string().min(1),
    version: z.string().min(1),
    lastUpdated: z.iso.date(),
    repoUrl: link.optional(),
  }),
  features: z.array(
    z.object({
      id: z.string().min(1),
      title: z.string().min(1),
      description: z.string().min(1),
      href: link,
      icon: z.enum(['chart', 'newspaper', 'wallet', 'bell', 'sparkles']),
      enabled: z.boolean(),
    })
  ),
  howItWorks: z.array(z.string().min(1)).min(1),
  // Lanes of the "How it works" diagram; a `pending` step is drawn dashed
  // and marked "Coming soon".
  diagram: z
    .array(
      z.object({
        steps: z.array(z.object({ label: z.string().min(1), pending: z.boolean().optional() })).min(1),
        output: z.string().min(1),
      })
    )
    .min(1),
  dataSources: z.array(z.object({ name: z.string().min(1), url: link, usage: z.string().min(1) })).min(1),
  // How headlines are used, shown under the source list.
  newsNote: z.string().min(1),
  attribution: z.object({
    text: z.string().min(1),
    url: link,
  }),
  ai: z.object({
    model: z.string().min(1),
    // Not in the spec's model: lets the page say honestly when the AI step
    // is switched off, rather than describe it as running.
    status: z.enum(['live', 'coming-soon']),
    statusNote: z.string().min(1),
    uses: z.array(z.string().min(1)),
    doesNot: z.array(z.string().min(1)),
    limitations: z.array(z.string().min(1)),
    updateIntervalHours: z.number().int().positive(),
  }),
  privacy: z.array(z.string().min(1)).min(1),
  disclaimer: z.string().min(1),
  stack: z.array(z.object({ group: z.string().min(1), items: z.array(z.string().min(1)).min(1) })),
  highlights: z.array(z.object({ title: z.string().min(1), body: z.string().min(1) })).min(1),
  developer: z.object({
    name: z.string().min(1),
    role: z.string().min(1),
    bio: z.string().min(1),
    avatarUrl: link.optional(),
    links: z.array(z.object({ label: z.enum(['GitHub', 'LinkedIn', 'Website', 'Email']), href: link })),
    openToWork: z.boolean(),
  }),
  changelog: z.array(z.object({ version: z.string().min(1), date: z.iso.date(), changes: z.array(z.string().min(1)).min(1) })).optional(),
  roadmap: z.array(z.string().min(1)).optional(),
});

export type AboutContent = z.infer<typeof aboutSchema>;

export const about: AboutContent = {
  app: {
    name: SITE.name,
    tagline: 'Track crypto prices, market news, AI chart analysis and your holdings in one place, with the alerts you choose.',
    description:
      'CryptoTracker is a free market dashboard for crypto. It shows live prices and candle charts, groups the day’s market-moving news into single stories with AI sentiment, explains a coin’s chart with AI on request, tracks what you hold across wallets and exchanges, and sends the alerts you turn on. No account needed, and it installs on your phone like an app.',
    badge: 'Personal portfolio project',
    version: '0.2.0',
    lastUpdated: SITE.lastUpdated,
    repoUrl: 'https://github.com/mikemariano19/crypto-tracker',
  },

  features: [
    {
      id: 'market',
      title: 'Market data & charts',
      description:
        'Live prices for the top 1,000 coins, 24h movers, trending coins, market cap and the Fear & Greed index, with candle charts from 1 day to 1 year, shown in dozens of currencies.',
      href: '/',
      icon: 'chart',
      enabled: true,
    },
    {
      id: 'insight',
      title: 'AI price analysis',
      description:
        'On a top coin’s chart, tap AI Analyze for support and resistance zones, EMA, RSI and volume, with a short plain-language outlook. The levels are calculated in code; the AI only explains them.',
      href: '/',
      icon: 'sparkles',
      enabled: true,
    },
    {
      id: 'news',
      title: 'Crypto news & sentiment',
      description:
        'Headlines from major crypto outlets, grouped by event and ranked by how much they matter to traders, with AI sentiment, summaries and trader takes on the top stories.',
      href: '/news',
      icon: 'newspaper',
      enabled: true,
    },
    {
      id: 'portfolio',
      title: 'Wallet tracker',
      description: 'Watch-only holdings in named wallets, valued in your currency with live prices, and stored only in your browser.',
      href: '/portfolio',
      icon: 'wallet',
      enabled: true,
    },
    {
      id: 'alerts',
      title: 'Alerts',
      description:
        'Price alerts you set, big moves on your coins, market drops or rallies, breaking news and a daily brief, as phone or desktop notifications. Opt-in, at most 5 a day, with quiet hours.',
      href: '/alerts',
      icon: 'bell',
      enabled: true,
    },
  ],

  howItWorks: [
    'Prices and market data come from CoinGecko and refresh about every minute, through a shared server cache.',
    'Every few hours the server reads the latest headlines, removes repeats, groups stories about the same event and scores how much each matters to traders. The top stories get AI sentiment and a short summary.',
    'When you tap AI Analyze, code calculates the price levels and indicators from the chart, and the AI writes a short explanation that can only refer to those levels.',
    'Every 10 minutes the server checks prices and news against the alerts you turned on, and sends them through your browser’s own push service.',
    'Your wallets never leave your browser; only the list of coins is sent to look up prices.',
  ],

  diagram: [
    {
      steps: [{ label: 'News sources' }, { label: 'Relevance filter' }, { label: 'AI sentiment' }],
      output: 'News feed',
    },
    { steps: [{ label: 'CoinGecko' }, { label: 'Server cache' }], output: 'Prices, charts & market data' },
    { steps: [{ label: 'Chart candles' }, { label: 'Levels & indicators (code)' }, { label: 'AI explanation' }], output: 'AI price analysis' },
    { steps: [{ label: 'Your alert settings' }, { label: '10-minute check' }, { label: 'Web push' }], output: 'Alerts' },
    { steps: [{ label: 'Your browser (localStorage)' }], output: 'Wallet tracker' },
  ],

  dataSources: [
    { name: 'CoinGecko', url: 'https://www.coingecko.com', usage: 'Prices, charts, market data, coin list, exchange logos' },
    { name: 'Alternative.me', url: 'https://alternative.me/crypto/fear-and-greed-index/', usage: 'Crypto Fear & Greed Index' },
    { name: 'CoinDesk', url: 'https://www.coindesk.com', usage: 'News headlines (RSS)' },
    { name: 'The Block', url: 'https://www.theblock.co', usage: 'News headlines (RSS)' },
    { name: 'Cointelegraph', url: 'https://cointelegraph.com', usage: 'News headlines (RSS)' },
    { name: 'Decrypt', url: 'https://decrypt.co', usage: 'News headlines (RSS)' },
    { name: 'Bitcoin Magazine', url: 'https://bitcoinmagazine.com', usage: 'News headlines (RSS)' },
    { name: 'CryptoSlate', url: 'https://cryptoslate.com', usage: 'News headlines (RSS)' },
  ],

  newsNote:
    'Every headline links to its original publisher. The feed shows the headline and either the outlet’s own short description or an AI-written summary, never the full article.',

  attribution: { ...SITE.attribution },

  ai: {
    model: 'Claude Haiku 5.5',
    status: 'live',
    statusNote:
      'AI analysis is on. If the daily AI budget runs out or the AI is unavailable, stories keep their rule-based ranking and charts still show the calculated levels, clearly marked.',
    uses: [
      'Sentiment split for each top news story (bullish / neutral / bearish percentages)',
      'A short news summary written in its own words, and a one-line trader take',
      'A plain-language outlook for a coin’s chart when you tap AI Analyze, referring only to the levels code calculated',
    ],
    doesNot: [
      'See your wallets, holdings or alerts',
      'Pick price levels: support, resistance and indicators are calculated in code',
      'Make trades, place orders or tell you to buy or sell',
      'Learn from or train on your data',
    ],
    limitations: [
      'AI can be wrong or miss context.',
      'Only the top stories of each update are analysed, and chart analysis covers the top coins only.',
      'Sentiment and outlooks describe the news and the chart; they are not price predictions.',
      'Past outlooks are scored once their window passes, and the hit rate only shows after 20 scored outlooks.',
    ],
    // Must match NEWS_FETCH_INTERVAL_HOURS in the backend (config/news.php).
    updateIntervalHours: 6,
  },

  privacy: [
    'Wallets and holdings are stored only in your browser (localStorage). They are never sent to a server; only coin IDs are sent to fetch prices.',
    'Clearing your browser data deletes your wallets. Use Export on the Portfolio page to keep a backup.',
    'Alerts need no account. The server keeps only your browser’s push subscription, your alert settings, the coins and prices you pick and, if you turn on Big moves, the IDs of your favorite and wallet coins. Never amounts.',
    'Notifications are only asked for when you tap a bell or switch, never on page load, and you can turn them all off on the Alerts page.',
    'This app never asks for seed phrases, private keys or exchange API keys, and you should never enter them anywhere.',
    'No accounts and no tracking cookies.',
  ],

  disclaimer:
    'This app is for information and education only. Nothing here is financial, investment, or trading advice. Crypto prices are highly volatile and you can lose money. AI-generated analysis, outlooks and alerts may be inaccurate or late. Always do your own research.',

  stack: [
    { group: 'Frontend', items: ['Next.js', 'React', 'TypeScript', 'SWR', 'Tailwind CSS', 'Radix UI', 'Lightweight Charts', 'Recharts'] },
    { group: 'App & alerts', items: ['Progressive Web App', 'Web Push (VAPID)', 'Service worker'] },
    { group: 'Real-time', items: ['Laravel Reverb', 'Laravel Echo (WebSockets)'] },
    { group: 'Backend', items: ['Laravel', 'PHP', 'Scheduler & queues', 'PostgreSQL', 'SQLite (local)', 'Docker'] },
    { group: 'AI', items: ['Claude API (Anthropic SDK)', 'Structured output'] },
    { group: 'Data & quality', items: ['CoinGecko API', 'News RSS feeds', 'Zod', 'decimal.js', 'Vitest', 'PHPUnit'] },
  ],

  highlights: [
    {
      title: 'Code calculates, AI explains',
      body: 'Support and resistance zones come from tested swing points, and indicators are computed in code. The AI only describes them by name, and any answer that invents a price is rejected.',
    },
    {
      title: 'Alerts people keep on',
      body: 'Every alert is opt-in, capped at 5 a day with a cooldown per coin, paused in quiet hours, and several hits arrive as one message. Wording stays calm, with no “buy now” calls.',
    },
    {
      title: 'Shared, per-coin price cache',
      body: 'Prices are cached one coin at a time, so every visitor’s portfolio reuses the same entries. A request only asks CoinGecko for coins that are missing or stale, in a single call.',
    },
    {
      title: 'Resilient to API limits',
      body: 'Upstream data is served stale-while-revalidate with cooldowns after failures. When CoinGecko is down, the last good data is shown and clearly marked.',
    },
    {
      title: 'Accurate money math',
      body: 'Holdings are stored as exact decimal strings and all values use a decimal library. No floating-point surprises like 0.1 + 0.2.',
    },
    {
      title: 'Installs like an app',
      body: 'On phones and tablets it installs to the Home Screen and opens in its own window, in Chrome, Brave, Edge, Samsung Internet, Firefox for Android and Safari.',
    },
    {
      title: 'Privacy by design',
      body: 'The wallet tracker is watch-only and local-only, with a guard that rejects anything that looks like a seed phrase or private key.',
    },
    {
      title: 'Accessible UI',
      body: 'Price and sentiment changes always pair colour with arrows, signs and text, every chart has a readable legend, and dark mode follows your device.',
    },
  ],

  // Fill these in yourself; nothing here is shown while it's still a [placeholder].
  developer: {
    name: '[Your Name]',
    role: '[Your role, e.g. Frontend Developer — Next.js & TypeScript]',
    bio: '[2–3 sentences about you]',
    links: [
      { label: 'GitHub', href: '[https://github.com/your-username]' },
      { label: 'LinkedIn', href: '[https://www.linkedin.com/in/your-profile]' },
      { label: 'Website', href: '[https://your-site.example]' },
      { label: 'Email', href: '[mailto:you@example.com]' },
    ],
    openToWork: false,
  },

  changelog: [
    {
      version: '0.2.0',
      date: '2026-11-08',
      changes: [
        'Added alerts: price alerts, big moves on your coins, market drops or rallies, breaking news and a daily brief',
        'The app can now be installed on phones and tablets',
        'Added AI price analysis on coin charts (1D, 7D and 30D) with support and resistance zones',
        'All chart ranges now show candles, from 1 day to 1 year',
        'Turned on AI sentiment, summaries and trader takes for top news stories',
        'Added dark mode, more display currencies and a bottom navigation bar on phones',
      ],
    },
    {
      version: '0.1.0',
      date: '2026-10-30',
      changes: [
        'Added the wallet tracker with USD/PHP values, backups and exchange logos',
        'Added the crypto news feed with story grouping and relevance scoring',
        'Added coin search and favorites',
      ],
    },
  ],

  roadmap: ['Cost basis and profit/loss tracking', 'AI price analysis for more coins', 'Alert history that follows you across devices'],
};
