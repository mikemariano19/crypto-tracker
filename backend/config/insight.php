<?php

/*
 * AI price insight on coin pages. The plain chart works for every coin; only
 * the on-demand analysis is limited to the list below.
 */
return [

    // Each refresh costs two CoinGecko calls, so visitors share one copy.
    'chart_fresh_seconds' => (int) env('INSIGHT_CHART_FRESH_SECONDS', 300),

    // The 90D and 1Y candles barely change from one refresh to the next.
    'long_chart_fresh_seconds' => (int) env('INSIGHT_LONG_CHART_FRESH_SECONDS', 1_800),

    // CoinGecko id => ticker, which is how the news feed tags its stories. A
    // hand-kept snapshot of the top coins by market cap: it should only change
    // when someone decides to spend AI credits on another. Stablecoins and
    // similar pegged assets are left out on purpose: their price barely moves,
    // so their zones and outlook would mean nothing.
    'allowed_coins' => [
        'bitcoin' => 'BTC',
        'ethereum' => 'ETH',
        'binancecoin' => 'BNB',
        'ripple' => 'XRP',
        'solana' => 'SOL',
        'tron' => 'TRX',
        'zcash' => 'ZEC',
        'hyperliquid' => 'HYPE',
        'monero' => 'XMR',
        'dogecoin' => 'DOGE',
        'whitebit' => 'WBT',
        'leo-token' => 'LEO',
        'chainlink' => 'LINK',
        'cardano' => 'ADA',
        'bitcoin-cash' => 'BCH',
        'stellar' => 'XLM',
    ],

    // How long a finished analysis is shared by all visitors.
    'cache_seconds' => [
        '1d' => (int) env('INSIGHT_CACHE_MINUTES_1D', 60) * 60,
        '7d' => (int) env('INSIGHT_CACHE_MINUTES_7D', 360) * 60,
        '30d' => (int) env('INSIGHT_CACHE_MINUTES_30D', 720) * 60,
    ],

    // Short, so a paused or failed outlook can fill in later the same day.
    'no_outlook_cache_seconds' => 600,

    // How long a click waits for someone else's analysis of the same coin.
    'lock_wait_seconds' => 10,

    // The whole Analyze request must finish within this. Next's rewrite proxy
    // drops a request after 30 seconds, so this leaves some room for queueing.
    'deadline_seconds' => (int) env('INSIGHT_DEADLINE_SECONDS', 25),

    // An AI call given less time than this would likely time out and still
    // cost tokens, so the outlook is skipped instead.
    'min_ai_seconds' => 8,

    // Unset means sharing NEWS_DAILY_AI_TOKEN_BUDGET as one combined counter.
    'daily_ai_token_budget' => env('INSIGHT_DAILY_AI_TOKEN_BUDGET'),

    // The model and API key are shared with the news feed (config/news.php).
    'ai' => [
        'max_output_tokens' => (int) env('INSIGHT_MAX_OUTPUT_TOKENS', 400),
        'effort' => env('INSIGHT_AI_EFFORT', 'low'),
    ],

    // Scoring past outlooks against what the price then did.
    'accuracy' => [
        // A smaller move than this counts as flat, not as a move either way.
        'flat_band_pct' => ['1d' => 0.5, '7d' => 2.0, '30d' => 5.0],
        // Later than this, the price is no longer a fair test of the outlook.
        'late_after_seconds' => 21_600,
        // A percentage from fewer outlooks than this would mostly be noise.
        'min_sample' => 20,
    ],

    // Settings for TechnicalAnalysis, per timeframe.
    'analysis' => [
        '1d' => [
            'visible_seconds' => 86_400,
            'swing_window' => 3,
            'zone_width_pct' => 0.5,
            'ema_fast' => 20,
            // CoinGecko's free tier has only 48 candles at this size, too few
            // for a 50-period average, so 1D trend comes from EMA20 alone.
            'ema_slow' => null,
            'rsi_period' => 14,
            'volume_period' => 20,
        ],
        '7d' => [
            'visible_seconds' => 604_800,
            'swing_window' => 2,
            'zone_width_pct' => 1.0,
            'ema_fast' => 20,
            'ema_slow' => 50,
            'rsi_period' => 14,
            'volume_period' => 20,
        ],
        // The same 4-hour candles as 7D, over the whole month. A wider swing
        // window keeps only the turns that mattered at this scale.
        '30d' => [
            'visible_seconds' => 2_592_000,
            'swing_window' => 4,
            'zone_width_pct' => 1.5,
            'ema_fast' => 20,
            'ema_slow' => 50,
            'rsi_period' => 14,
            'volume_period' => 20,
        ],
    ],

];
