<?php

/*
 * Suggestions for the wallet tracker's "New wallet" name field.
 *
 * Exchanges come from CoinGecko (with their logos). Listed here are wallets
 * and local apps CoinGecko doesn't cover. Their icons are read from each
 * site once (`php artisan wallets:icons`, also scheduled) and served from
 * our own API, so the browser never contacts these companies.
 */
return [

    // How many CoinGecko exchanges to suggest (by trust rank).
    'exchanges_limit' => 100,

    // id => name, homepage, kind ("wallet" | "app").
    'curated' => [
        'ledger' => ['name' => 'Ledger', 'url' => 'https://www.ledger.com', 'kind' => 'wallet'],
        'trezor' => ['name' => 'Trezor', 'url' => 'https://trezor.io', 'kind' => 'wallet'],
        'tangem' => ['name' => 'Tangem', 'url' => 'https://tangem.com', 'kind' => 'wallet'],
        'safepal' => ['name' => 'SafePal', 'url' => 'https://www.safepal.com', 'kind' => 'wallet'],
        'metamask' => ['name' => 'MetaMask', 'url' => 'https://metamask.io', 'kind' => 'wallet'],
        'trust-wallet' => ['name' => 'Trust Wallet', 'url' => 'https://trustwallet.com', 'kind' => 'wallet'],
        'phantom' => ['name' => 'Phantom', 'url' => 'https://phantom.com', 'kind' => 'wallet'],
        'exodus' => ['name' => 'Exodus', 'url' => 'https://www.exodus.com', 'kind' => 'wallet'],
        'rabby' => ['name' => 'Rabby', 'url' => 'https://rabby.io', 'kind' => 'wallet'],
        'electrum' => ['name' => 'Electrum', 'url' => 'https://electrum.org', 'kind' => 'wallet'],
        'coinbase-wallet' => ['name' => 'Coinbase Wallet', 'url' => 'https://www.coinbase.com/wallet', 'kind' => 'wallet'],
        'coins-ph' => ['name' => 'Coins.ph', 'url' => 'https://coins.ph', 'kind' => 'app'],
        'pdax' => ['name' => 'PDAX', 'url' => 'https://pdax.ph', 'kind' => 'app'],
        'gcash' => ['name' => 'GCash', 'url' => 'https://www.gcash.com', 'kind' => 'app'],
        'maya' => ['name' => 'Maya', 'url' => 'https://www.maya.ph', 'kind' => 'app'],
    ],
];
