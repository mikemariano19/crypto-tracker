<?php

/*
 * Rule-based "is this useful to a trader?" scoring (0–100), no AI involved.
 * See RelevanceScorer for how the parts add up.
 *
 * Matching is whole-word and allows simple suffixes (ETF → ETFs, hack →
 * hacked). Terms written in ALL CAPS match case-sensitively, so "SEC" won't
 * match "sec" and "SOL" won't match "sol".
 */
return [

    // Keyword groups: term => tag shown on the story card.
    'groups' => [
        'high' => [
            'weight' => 25,
            'terms' => [
                'ETF' => 'ETF',
                'SEC' => 'Regulation',
                'CFTC' => 'Regulation',
                'hack' => 'Security',
                'exploit' => 'Security',
                'drained' => 'Security',
                'liquidation' => 'Liquidations',
                'Fed' => 'Macro',
                'Federal Reserve' => 'Macro',
                'FOMC' => 'Macro',
                'CPI' => 'Macro',
                'rate cut' => 'Macro',
                'rate hike' => 'Macro',
                'delist' => 'Exchange',
                'token unlock' => 'Unlock',
                'unlock' => 'Unlock',
                'halving' => 'Halving',
                'depeg' => 'Stablecoin',
                'bankruptcy' => 'Risk',
                'insolvent' => 'Risk',
                'lawsuit' => 'Legal',
                'ban' => 'Regulation',
            ],
        ],
        'medium' => [
            'weight' => 15,
            'terms' => [
                'listing' => 'Exchange',
                'lists' => 'Exchange',
                'upgrade' => 'Upgrade',
                'hard fork' => 'Upgrade',
                'mainnet' => 'Upgrade',
                'whale' => 'Whales',
                'inflow' => 'Flows',
                'outflow' => 'Flows',
                'regulation' => 'Regulation',
                'stablecoin' => 'Stablecoin',
                'treasury' => 'Institutional',
                'BlackRock' => 'Institutional',
                'institutional' => 'Institutional',
                'all-time high' => 'Price',
                'record high' => 'Price',
                'rally' => 'Price',
                'plunge' => 'Price',
                'crash' => 'Price',
                'sell-off' => 'Price',
                'short squeeze' => 'Derivatives',
                'open interest' => 'Derivatives',
                'futures' => 'Derivatives',
                'tariff' => 'Macro',
                'inflation' => 'Macro',
                'airdrop' => 'Airdrop',
                'acquisition' => 'M&A',
            ],
        ],
    ],

    // Keyword points are capped so a keyword-stuffed headline can't max out.
    'keyword_cap' => 60,

    // A term found only in the snippet counts for this share of its weight.
    'snippet_factor' => 0.5,

    // Coins: ticker => names. The ticker itself is also matched (case-sensitive).
    'assets' => [
        'BTC' => ['Bitcoin'],
        'ETH' => ['Ethereum', 'Ether'],
        'SOL' => ['Solana'],
        'XRP' => ['Ripple'],
        'BNB' => ['Binance Coin'],
        'DOGE' => ['Dogecoin'],
        'ADA' => ['Cardano'],
        'TRX' => ['Tron'],
        'AVAX' => ['Avalanche'],
        'LINK' => ['Chainlink'],
        'TON' => ['Toncoin'],
        'DOT' => ['Polkadot'],
        'LTC' => ['Litecoin'],
        'SUI' => [],
        'USDT' => ['Tether'],
        'USDC' => ['Circle'],
    ],
    'asset_weight' => 15,
    'extra_asset_weight' => 5,
    'asset_cap' => 25,

    // More outlets covering the same event = bigger story.
    'per_extra_source' => 8,
    'source_bonus_cap' => 24,

    // Added as credibility (0.5–1.0) × this.
    'credibility_weight' => 15,

    // Low-value content: each distinct match subtracts the penalty.
    'penalty' => 40,
    'penalty_terms' => [
        'sponsored',
        'press release',
        'price prediction',
        'price predictions',
        'could reach',
        'how to buy',
        'what is',
        'beginner',
        'guide to',
        'best crypto to buy',
        'presale',
    ],

];
