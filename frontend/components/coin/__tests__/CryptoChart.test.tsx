// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { SWRConfig } from 'swr';
import CryptoChart from '@/components/coin/CryptoChart';
import type { PriceInsight } from '@/types/insight';

// The real chart needs a canvas; these tests are about what it's given.
vi.mock('next/dynamic', () => ({
  default: () =>
    function FakeChart({ series, label, insight }: { series: { kind: string }; label: string; insight?: PriceInsight | null }) {
      return <div data-testid="chart" data-kind={series.kind} data-analysis={insight ? 'on' : 'off'} aria-label={label} />;
    },
}));

// Currency has its own request, which isn't what's being tested here.
vi.mock('@/hooks/useDisplayCurrency', () => ({
  useDisplayCurrency: () => ({ money: { code: 'usd', rate: 1 } }),
}));

const candleBody = (analysisAllowed = true) => ({
  candles: [
    { time: 1_000, open: 100, high: 110, low: 90, close: 105 },
    { time: 2_000, open: 105, high: 120, low: 100, close: 110 },
  ],
  volume: [{ time: 2_000, value: 5_000 }],
  analysisAllowed,
});


const insightBody = (changes: Partial<PriceInsight> = {}): PriceInsight => ({
  coinId: 'bitcoin',
  timeframe: '7d',
  price: 110,
  zones: [
    { id: 'R1', type: 'resistance', from: 118, to: 122, distancePct: 9, strength: 'strong', touches: 3, testing: false },
    { id: 'S1', type: 'support', from: 88, to: 92, distancePct: -18, strength: 'weak', touches: 1, testing: false },
  ],
  ema20: [],
  ema50: [],
  rsi: [],
  rsiLatest: 56,
  rsiState: 'neutral',
  volume: { vsAvgPct: 18, label: 'normal' },
  trend: 'up',
  newsPins: [],
  ai: {
    outlook: { bullish: 58, neutral: 27, bearish: 15 },
    label: 'bullish',
    confidence: 'medium',
    summary: 'Technicals lean bullish.',
    reasons: ['Trend is up'],
    watch: 'A close below S1 would change the view.',
  },
  aiStatus: 'ok',
  accuracy: null,
  analyzedAt: new Date(Date.now() - 720_000).toISOString(),
  expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  ...changes,
});

const fetchMock = vi.fn();

type Reply = { status?: number; body: unknown };

type Handlers = {
  allowed?: boolean;
  /** The GET: null means no analysis exists yet. */
  cached?: PriceInsight | null;
  /** The POST behind the button. */
  run?: () => Reply | Promise<Reply>;
  chart?: () => Reply;
};

const NOT_CACHED: Reply = { status: 404, body: { success: false, cached: false, error: 'No analysis yet.' } };

function respond({ allowed = true, cached = null, run, chart }: Handlers = {}) {
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    let reply: Reply;

    if (url.includes('/api/insight/')) {
      if (init?.method === 'POST') {
        reply = run ? await run() : { body: { success: true, data: insightBody() } };
      } else {
        reply = cached ? { body: { success: true, data: cached } } : NOT_CACHED;
      }
    } else if (chart) {
      reply = chart();
    } else {
      // Like the API, longer ranges are never open to analysis.
      reply = { body: { success: true, data: candleBody(allowed && /tf=(1d|7d)/.test(url)) } };
    }

    return new Response(JSON.stringify(reply.body), { status: reply.status ?? 200 });
  });
}

function renderChart(props = {}) {
  // A fresh cache each time, so one test's responses can't reach the next.
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false }}>
      <CryptoChart coinId="bitcoin" {...props} />
    </SWRConfig>,
  );
}

const requests = () => fetchMock.mock.calls.map(([url, init]) => ({ url: String(url), method: init?.method ?? 'GET' }));
const posts = () => requests().filter((request) => request.method === 'POST');

const analysisState = () => screen.getByTestId('chart').dataset.analysis;

async function clickAnalyze() {
  fireEvent.click(await screen.findByRole('button', { name: /AI Analyze/ }));
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('plain chart', () => {
  it('offers all five ranges and starts on 7D', async () => {
    respond();
    renderChart();

    for (const label of ['1D', '7D', '30D', '90D', '1Y']) {
      expect(screen.getByRole('button', { name: label })).toBeTruthy();
    }

    expect(screen.getByRole('button', { name: '7D' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: '1D' }).getAttribute('aria-pressed')).toBe('false');

    await waitFor(() => expect(screen.getByTestId('chart').dataset.kind).toBe('candles'));
    expect(requests()[0].url).toContain('/api/coins/bitcoin/chart?tf=7d');
  });

  it.each([
    ['1D', '/api/coins/bitcoin/chart?tf=1d', 'candles'],
    ['30D', '/api/coins/bitcoin/chart?tf=30d', 'candles'],
    ['90D', '/api/coins/bitcoin/chart?tf=90d', 'candles'],
    ['1Y', '/api/coins/bitcoin/chart?tf=1y', 'candles'],
  ])('%s loads its own data and draws it', async (label, url, kind) => {
    respond();
    renderChart();

    await screen.findByTestId('chart');
    fireEvent.click(screen.getByRole('button', { name: label }));

    await waitFor(() => expect(requests().some((request) => request.url.includes(url))).toBe(true));
    await waitFor(() => expect(screen.getByTestId('chart').dataset.kind).toBe(kind));
    expect(screen.getByRole('button', { name: label }).getAttribute('aria-pressed')).toBe('true');
  });

  it('never runs an analysis on its own, whichever range is picked', async () => {
    respond();
    renderChart();
    await screen.findByTestId('chart');

    for (const label of ['1D', '30D', '90D', '1Y', '7D']) {
      fireEvent.click(screen.getByRole('button', { name: label }));
      await screen.findByTestId('chart');
    }

    await waitFor(() => expect(requests().length).toBeGreaterThanOrEqual(4));
    expect(posts()).toEqual([]);
  });

  it('shows the range stats and change', async () => {
    respond();
    renderChart();

    await screen.findByText('7D Low');
    expect(screen.getByText('$90.00')).toBeTruthy();
    expect(screen.getByText('$120.00')).toBeTruthy();
    expect(screen.getByText('$5K')).toBeTruthy();
    expect(screen.getByText('10.00%')).toBeTruthy();
  });

  it('ends on the live price', async () => {
    respond();
    renderChart({ livePrice: 130, liveUpdatedAt: new Date(3_000_000).toISOString() });

    await screen.findByTestId('chart');

    // Both the latest price and the new high of the range.
    expect(screen.getAllByText('$130.00')).toHaveLength(2);
    expect(screen.getByText('30.00%')).toBeTruthy();
  });

  it('describes the chart for screen readers', async () => {
    respond();
    renderChart();

    const chart = await screen.findByTestId('chart');
    expect(chart.getAttribute('aria-label')).toBe(
      'bitcoin price chart, past 7 days. Latest $110.00, low $90.00, high $120.00.',
    );
  });

  it('offers a retry when the data fails, and recovers', async () => {
    respond({ chart: () => ({ status: 503, body: { success: false, error: 'Unavailable' } }) });
    renderChart();

    const retry = await screen.findByRole('button', { name: 'Try again' });
    expect(screen.getByText('Chart data is temporarily unavailable')).toBeTruthy();

    respond();
    fireEvent.click(retry);

    await screen.findByTestId('chart');
  });

  it('never shows the previous range under the new name when a request fails', async () => {
    respond();
    renderChart();

    await screen.findByText('7D Low');

    respond({ chart: () => ({ status: 503, body: { success: false, error: 'Unavailable' } }) });
    fireEvent.click(screen.getByRole('button', { name: '30D' }));

    await screen.findByText('Chart data is temporarily unavailable');
    expect(screen.queryByTestId('chart')).toBeNull();
    expect(screen.queryByText('30D Low')).toBeNull();
    expect(screen.queryByText('7D Low')).toBeNull();

    // Going back to a range that did load shows it again straight away.
    fireEvent.click(screen.getByRole('button', { name: '7D' }));
    await screen.findByText('7D Low');
    expect(screen.getByTestId('chart')).toBeTruthy();
  });

  it('never draws an analysis on another range’s candles', async () => {
    respond({ cached: insightBody({ timeframe: '1d' }) });
    renderChart();

    fireEvent.click(await screen.findByRole('button', { name: '1D' }));
    fireEvent.click(await screen.findByRole('button', { name: /AI Analyze.*Ready/ }));
    await screen.findByText('Technicals lean bullish.');

    // 7D fails to refresh and 1D's own data stays. The analysis stays with it.
    expect(screen.getByRole('button', { name: '1D' }).getAttribute('aria-pressed')).toBe('true');
    expect(analysisState()).toBe('on');

    respond({ chart: () => ({ status: 503, body: { success: false, error: 'Unavailable' } }) });
    fireEvent.click(screen.getByRole('button', { name: '30D' }));

    await screen.findByText('Chart data is temporarily unavailable');
    expect(screen.queryByRole('complementary', { name: 'Analysis' })).toBeNull();
  });
});

describe('AI Analyze', () => {
  it('only appears on 1D and 7D', async () => {
    respond();
    renderChart();

    await screen.findByRole('button', { name: /AI Analyze/ });

    fireEvent.click(screen.getByRole('button', { name: '30D' }));
    await screen.findByText('30D Low');
    expect(screen.getByTestId('chart').dataset.kind).toBe('candles');
    // Not limited to some coins: no range this long can be analyzed.
    expect(screen.queryByText('AI analysis available for top coins.')).toBeNull();
    expect(screen.queryByRole('button', { name: /AI Analyze/ })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '1D' }));
    await screen.findByRole('button', { name: /AI Analyze/ });
  });

  it('is replaced by a note for coins outside the list', async () => {
    respond({ allowed: false });
    renderChart();

    await screen.findByText('AI analysis available for top coins.');
    expect(screen.queryByRole('button', { name: /AI Analyze/ })).toBeNull();

    // No need to even ask for a result that can't exist.
    expect(requests().some((request) => request.url.includes('/api/insight'))).toBe(false);
  });

  it('runs on click and shows levels, outlook and toggles', async () => {
    respond();
    renderChart();

    await clickAnalyze();

    await screen.findByText('Technicals lean bullish.');
    expect(analysisState()).toBe('on');
    expect(posts()).toHaveLength(1);
    expect(posts()[0].url).toContain('/api/insight/bitcoin?tf=7d');

    const panel = screen.getByRole('complementary', { name: 'Analysis' });
    expect(within(panel).getByRole('table')).toBeTruthy();
    expect(within(panel).getByText('Trend is up')).toBeTruthy();
    expect(within(panel).getByText('A close below S1 would change the view.')).toBeTruthy();
    expect(within(panel).getByRole('link', { name: 'Not financial advice.' }).getAttribute('href')).toBe('/about#disclaimer');

    for (const label of ['MA', 'RSI', 'Volume', 'S/R']) {
      expect(screen.getByRole('button', { name: label }).getAttribute('aria-pressed')).toBe('true');
    }

    // The button has done its job.
    expect(screen.queryByRole('button', { name: /AI Analyze/ })).toBeNull();
  });

  it('adds the nearest levels to the chart description', async () => {
    respond();
    renderChart();

    await clickAnalyze();
    await screen.findByText('Technicals lean bullish.');

    expect(screen.getByTestId('chart').getAttribute('aria-label')).toContain(
      'Nearest resistance $120.00. Nearest support $90.00.',
    );
  });

  it('shows a busy state while running', async () => {
    let finish: (reply: Reply) => void = () => {};

    respond({ run: () => new Promise<Reply>((resolve) => { finish = resolve; }) });
    renderChart();

    await clickAnalyze();

    const busy = await screen.findByRole('button', { name: /Analyzing chart/ });
    expect((busy as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByLabelText('Analyzing chart')).toBeTruthy();

    finish({ body: { success: true, data: insightBody() } });

    await screen.findByText('Technicals lean bullish.');
  });

  it('stays clean when a result exists, with a Ready badge and no spend on click', async () => {
    respond({ cached: insightBody() });
    renderChart();

    const button = await screen.findByRole('button', { name: /AI Analyze.*Ready/ });
    expect(analysisState()).toBe('off');

    fireEvent.click(button);

    await screen.findByText('Technicals lean bullish.');
    expect(posts()).toEqual([]);
  });

  it('Clear returns to the plain chart and keeps the result ready', async () => {
    respond();
    renderChart();

    await clickAnalyze();
    await screen.findByText('Technicals lean bullish.');

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

    await waitFor(() => expect(analysisState()).toBe('off'));
    expect(screen.queryByRole('complementary', { name: 'Analysis' })).toBeNull();

    const button = await screen.findByRole('button', { name: /AI Analyze.*Ready/ });
    fireEvent.click(button);

    await screen.findByText('Technicals lean bullish.');
    expect(posts()).toHaveLength(1);
  });

  it('switching timeframe shows a stored result, or the button, but never runs one', async () => {
    respond();
    renderChart();

    await clickAnalyze();
    await screen.findByText('Technicals lean bullish.');

    fireEvent.click(screen.getByRole('button', { name: '1D' }));

    await screen.findByRole('button', { name: /AI Analyze/ });
    expect(analysisState()).toBe('off');
    expect(posts()).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: '7D' }));

    await screen.findByText('Technicals lean bullish.');
    expect(posts()).toHaveLength(1);
  });

  it('remembers indicator choices', async () => {
    respond();
    renderChart();

    await clickAnalyze();
    await screen.findByText('Technicals lean bullish.');

    fireEvent.click(screen.getByRole('button', { name: 'RSI' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'RSI' }).getAttribute('aria-pressed')).toBe('false'));
    expect(JSON.parse(localStorage.getItem('cryptoTracker.insightToggles') ?? '{}').rsi).toBe(false);
  });

  it('offers no refresh while the result is fresh', async () => {
    respond({ cached: insightBody() });
    renderChart();

    fireEvent.click(await screen.findByRole('button', { name: /AI Analyze.*Ready/ }));
    await screen.findByText('Technicals lean bullish.');

    expect(screen.queryByRole('button', { name: 'Refresh analysis' })).toBeNull();
  });

  it.each([
    ['unavailable', 'AI outlook unavailable right now.'],
    ['budget_paused', 'AI outlook paused for today (daily limit reached).'],
  ] as const)('%s still shows the levels, with a message for the outlook', async (aiStatus, message) => {
    respond({ run: () => ({ body: { success: true, data: insightBody({ ai: null, aiStatus }) } }) });
    renderChart();

    await clickAnalyze();

    await screen.findByText(message);
    expect(screen.getByRole('table')).toBeTruthy();
    expect(analysisState()).toBe('on');
  });

  it('says when no support or resistance was found', async () => {
    respond({ run: () => ({ body: { success: true, data: insightBody({ zones: [] }) } }) });
    renderChart();

    await clickAnalyze();

    await screen.findByText('No resistance level found in this period.');
    expect(screen.getByText('No support level found in this period.')).toBeTruthy();
  });

  it('explains a rate limit and keeps the plain chart', async () => {
    respond({ run: () => ({ status: 429, body: { success: false, error: 'Too many', retryAfter: 42 } }) });
    renderChart();

    await clickAnalyze();

    await screen.findByText('Too many requests, try again in 42 seconds.');
    expect(analysisState()).toBe('off');
    expect(screen.getByRole('button', { name: /AI Analyze/ })).toBeTruthy();
  });

  it('keeps the plain chart on a failure, and the button works again', async () => {
    respond({ run: () => ({ status: 503, body: { success: false, error: 'Unavailable' } }) });
    renderChart();

    await clickAnalyze();

    await screen.findByText(/Couldn't run the analysis/);
    expect(analysisState()).toBe('off');

    respond();
    await clickAnalyze();

    await screen.findByText('Technicals lean bullish.');
    expect(screen.queryByText(/Couldn't run the analysis/)).toBeNull();
  });

  it('lists the chart news as ordinary links, for touch and keyboard', async () => {
    const pin = { time: 1_500, headline: 'SEC approves a product', source: 'Test News', url: 'https://news.test/a', label: 'bullish' as const };

    respond({ run: () => ({ body: { success: true, data: insightBody({ newsPins: [pin] }) } }) });
    renderChart();

    await clickAnalyze();

    await screen.findByText('News on this chart (1)');

    const link = screen.getByRole('link', { name: /SEC approves a product/ });
    expect(link.getAttribute('href')).toBe('https://news.test/a');

    // Its sentiment is in words too, not only color.
    expect(within(link.closest('li') as HTMLElement).getByText('Bullish')).toBeTruthy();
  });

  it('shows the track record once there is one, and hides it until then', async () => {
    respond({ run: () => ({ body: { success: true, data: insightBody({ accuracy: { matchedPct: 62, sample: 40, days: 30 } }) } }) });
    renderChart();

    await clickAnalyze();

    await screen.findByText(/7D outlooks matched direction 62% of the time \(last 30 days, 40 outlooks/);
    cleanup();

    respond();
    renderChart();

    await clickAnalyze();
    await screen.findByText('Technicals lean bullish.');
    expect(screen.queryByText(/matched direction/)).toBeNull();
  });

  it('has no news section when there is no news', async () => {
    respond();
    renderChart();

    await clickAnalyze();
    await screen.findByText('Technicals lean bullish.');

    expect(screen.queryByText(/News on this chart/)).toBeNull();
  });

  it('announces the result to screen readers', async () => {
    respond();
    renderChart();

    await clickAnalyze();
    await screen.findByText('Technicals lean bullish.');

    expect(screen.getByText('Analysis ready. Outlook bullish.').getAttribute('role')).toBe('status');
  });

  it('marks up the levels as a real table with row headers', async () => {
    respond();
    renderChart();

    await clickAnalyze();
    await screen.findByText('Technicals lean bullish.');

    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual(['Level', 'Price', 'Away', 'Strength']);
    expect(within(table).getByRole('rowheader', { name: /R1/ }).textContent).toContain('resistance');
  });

  it('wording never promises a prediction', async () => {
    respond();
    const { container } = renderChart();

    await clickAnalyze();
    await screen.findByText('Technicals lean bullish.');

    expect(container.textContent).not.toMatch(/prediction|signal|target|will go/i);
  });
});
