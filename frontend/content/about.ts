import { z } from 'zod';

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
    // Not in the spec's model: the AI step is built into the pipeline's
    // plan but not switched on yet, and the page must say so honestly.
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
    name: 'CryptoTracker',
    tagline: 'Track crypto prices, trader-relevant market news, and your holdings in one place.',
    description:
      'CryptoTracker is a free market dashboard for crypto. It shows live prices and market data, groups the day’s market-moving news into single stories, and lets you track what you hold across wallets and exchanges, without an account.',
    badge: 'Personal portfolio project',
    version: '0.1.0',
    lastUpdated: '2026-10-30',
    repoUrl: 'https://github.com/mikemariano19/crypto-tracker',
  },

  features: [
    {
      id: 'market',
      title: 'Market data',
      description: 'Live prices for the top 1,000 coins, 24h movers, trending coins, market cap and the Fear & Greed index.',
      href: '/',
      icon: 'chart',
      enabled: true,
    },
    {
      id: 'news',
      title: 'Crypto news & sentiment',
      description:
        'Headlines from major crypto outlets, grouped by event and ranked by how much they matter to traders. AI sentiment and trader takes are being added.',
      href: '/news',
      icon: 'newspaper',
      enabled: true,
    },
    {
      id: 'portfolio',
      title: 'Wallet tracker',
      description: 'Watch-only holdings in named wallets, valued in USD or PHP with live prices, and stored only in your browser.',
      href: '/portfolio',
      icon: 'wallet',
      enabled: true,
    },
  ],

  howItWorks: [
    'Every few hours the server reads the latest headlines from crypto news outlets.',
    'Repeats are removed, stories about the same event are grouped, and each story is scored for how much it matters to traders.',
    'The top stories are set aside for AI sentiment scoring (being switched on).',
    'Prices and market data come from CoinGecko and refresh about every minute.',
    'Your wallets never leave your browser; only the list of coins is sent to look up prices.',
  ],

  diagram: [
    {
      steps: [{ label: 'News sources' }, { label: 'Relevance filter' }, { label: 'AI sentiment', pending: true }],
      output: 'News feed',
    },
    { steps: [{ label: 'CoinGecko' }, { label: 'Server cache' }], output: 'Prices & market data' },
    { steps: [{ label: 'Your browser (localStorage)' }], output: 'Wallet tracker' },
  ],

  dataSources: [
    { name: 'CoinGecko', url: 'https://www.coingecko.com', usage: 'Prices, market data, coin list, exchange logos' },
    { name: 'Alternative.me', url: 'https://alternative.me/crypto/fear-and-greed-index/', usage: 'Crypto Fear & Greed Index' },
    { name: 'CoinDesk', url: 'https://www.coindesk.com', usage: 'News headlines (RSS)' },
    { name: 'The Block', url: 'https://www.theblock.co', usage: 'News headlines (RSS)' },
    { name: 'Cointelegraph', url: 'https://cointelegraph.com', usage: 'News headlines (RSS)' },
    { name: 'Decrypt', url: 'https://decrypt.co', usage: 'News headlines (RSS)' },
    { name: 'Bitcoin Magazine', url: 'https://bitcoinmagazine.com', usage: 'News headlines (RSS)' },
    { name: 'CryptoSlate', url: 'https://cryptoslate.com', usage: 'News headlines (RSS)' },
  ],

  newsNote:
    'Every headline links to its original publisher. The feed shows the headline and the outlet’s own short description (or an AI-written summary once AI is on), never the full article.',

  // CoinGecko's attribution guide: visible text, linked, no implied partnership.
  attribution: { text: 'Data provided by CoinGecko', url: 'https://www.coingecko.com' },

  ai: {
    model: 'Claude Haiku 5.5',
    status: 'coming-soon',
    statusNote:
      'AI analysis isn’t switched on yet. Until it is, stories are ranked by rule-based relevance only, and any sample analysis starts with a clear “Demo” label.',
    uses: [
      'Sentiment split for each top story (bullish / neutral / bearish percentages)',
      'A short summary written in its own words',
      'A one-line trader take on what the news may mean',
    ],
    doesNot: [
      'See your wallets or holdings',
      'Make trades or place orders',
      'Learn from or train on your data',
    ],
    limitations: [
      'AI can be wrong or miss context.',
      'Only the top stories of each update are analysed.',
      'Sentiment describes the news, it is not a price prediction.',
    ],
    // Must match NEWS_FETCH_INTERVAL_HOURS in the backend (config/news.php).
    updateIntervalHours: 6,
  },

  privacy: [
    'Wallets and holdings are stored only in your browser (localStorage). They are never sent to a server; only coin IDs are sent to fetch prices.',
    'Clearing your browser data deletes your wallets. Use Export on the Portfolio page to keep a backup.',
    'This app never asks for seed phrases, private keys or exchange API keys, and you should never enter them anywhere.',
    'No accounts and no tracking cookies.',
  ],

  disclaimer:
    'This app is for information and education only. Nothing here is financial, investment, or trading advice. Crypto prices are highly volatile and you can lose money. AI-generated analysis may be inaccurate. Always do your own research.',

  stack: [
    { group: 'Frontend', items: ['Next.js', 'React', 'TypeScript', 'SWR', 'Tailwind CSS', 'Radix UI', 'Recharts'] },
    { group: 'Real-time', items: ['Laravel Reverb', 'Laravel Echo (WebSockets)'] },
    { group: 'Backend', items: ['Laravel', 'PHP', 'Scheduler & queues', 'SQLite'] },
    { group: 'Data & quality', items: ['CoinGecko API', 'News RSS feeds', 'Zod', 'decimal.js', 'Vitest', 'PHPUnit'] },
  ],

  highlights: [
    {
      title: 'Shared, per-coin price cache',
      body: 'Prices are cached one coin at a time, so every visitor’s portfolio reuses the same entries. A request only asks CoinGecko for coins that are missing or stale, in a single call.',
    },
    {
      title: 'Accurate money math',
      body: 'Holdings are stored as exact decimal strings and all values use a decimal library. No floating-point surprises like 0.1 + 0.2.',
    },
    {
      title: 'Resilient to API limits',
      body: 'Upstream data is served stale-while-revalidate with cooldowns after failures. When CoinGecko is down, the last good data is shown and clearly marked.',
    },
    {
      title: 'Real-time updates',
      body: 'New prices and news batches are pushed over WebSockets and merged into the SWR cache, so pages update without reloads.',
    },
    {
      title: 'Privacy by design',
      body: 'The wallet tracker is watch-only and local-only, with a guard that rejects anything that looks like a seed phrase or private key.',
    },
    {
      title: 'Accessible UI',
      body: 'Price and sentiment changes always pair colour with arrows, signs and text, and every chart has a readable legend.',
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
      version: '0.1.0',
      date: '2026-10-30',
      changes: [
        'Added the wallet tracker with USD/PHP values, backups and exchange logos',
        'Added the crypto news feed with story grouping and relevance scoring',
        'Added coin search and favorites',
      ],
    },
  ],

  roadmap: ['AI sentiment and trader takes on top stories', 'Price alerts', 'Cost basis and profit/loss tracking'],
};
