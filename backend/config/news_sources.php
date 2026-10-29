<?php

/*
 * News sources for the AI news feed. Each entry is built into a NewsSource
 * adapter by NewsSources. Check a source's terms of use and rate limits
 * before enabling it.
 *
 * credibility: 0.5–1.0. Used in relevance scoring, picking a cluster's
 * primary article, and weighting the global sentiment.
 *
 * icon (optional): the outlet's site icon URL. Without it the icon is read
 * from the outlet's homepage once a month (see NewsIcons); sites that block
 * that lookup fall back to a letter tile in the UI.
 */
return [

    'user_agent' => 'CryptoTracker/1.0 (news reader)',

    'sources' => [
        [
            'key' => 'coindesk',
            'name' => 'CoinDesk',
            'type' => 'rss',
            'url' => 'https://www.coindesk.com/arc/outboundfeeds/rss/',
            'credibility' => 1.0,
            'enabled' => true,
        ],
        [
            'key' => 'theblock',
            'name' => 'The Block',
            'type' => 'rss',
            'url' => 'https://www.theblock.co/rss.xml',
            'credibility' => 0.95,
            'enabled' => true,
        ],
        [
            'key' => 'cointelegraph',
            'name' => 'Cointelegraph',
            'type' => 'rss',
            'url' => 'https://cointelegraph.com/rss',
            'credibility' => 0.85,
            'enabled' => true,
        ],
        [
            'key' => 'decrypt',
            'name' => 'Decrypt',
            'type' => 'rss',
            'url' => 'https://decrypt.co/feed',
            'credibility' => 0.85,
            'enabled' => true,
        ],
        [
            'key' => 'bitcoinmagazine',
            'name' => 'Bitcoin Magazine',
            'type' => 'rss',
            'url' => 'https://bitcoinmagazine.com/.rss/full/',
            'credibility' => 0.8,
            'enabled' => true,
        ],
        [
            'key' => 'cryptoslate',
            'name' => 'CryptoSlate',
            'type' => 'rss',
            'url' => 'https://cryptoslate.com/feed/',
            'credibility' => 0.7,
            'enabled' => true,
        ],
        [
            // Aggregator (many outlets in one call). Needs a free key from
            // developers.coindesk.com, so it stays off until one is set.
            'key' => 'cryptocompare',
            'name' => 'CryptoCompare',
            'type' => 'cryptocompare',
            'url' => 'https://min-api.cryptocompare.com/data/v2/news/',
            'api_key' => env('CRYPTOCOMPARE_API_KEY'),
            'credibility' => 0.6,
            'enabled' => (bool) env('CRYPTOCOMPARE_API_KEY'),
        ],
    ],

];
