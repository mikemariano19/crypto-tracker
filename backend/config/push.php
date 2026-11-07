<?php

/*
 * Web push alerts. Sending needs no paid service: the browser's own push
 * service delivers them, signed with our VAPID key. No AI is used here.
 */
return [

    // `php artisan push:vapid` prints a pair. Without them push is off.
    'vapid' => [
        'public_key' => env('VAPID_PUBLIC_KEY'),
        'private_key' => env('VAPID_PRIVATE_KEY'),
        // Push services contact this address if our pushes misbehave.
        'subject' => env('VAPID_SUBJECT', 'mailto:admin@example.com'),
    ],

    // A free external scheduler calls POST /api/push/check with this in the
    // X-Cron-Secret header, so alerts still go out while Render sleeps.
    // Empty turns that endpoint off.
    'cron_secret' => env('PUSH_CRON_SECRET'),

    // The server POSTs to whatever endpoint a browser gives it, so only the
    // real push services are accepted (a host or any subdomain of it).
    'allowed_hosts' => [
        'fcm.googleapis.com',          // Chrome, Edge on Android, Brave, Opera, Samsung
        'push.services.mozilla.com',   // Firefox
        'push.apple.com',              // Safari, iPhone home-screen apps
        'notify.windows.com',          // Edge on Windows
    ],

    // Rules that keep people from turning notifications off.
    'daily_cap' => (int) env('PUSH_DAILY_CAP', 5),
    'coin_cooldown_minutes' => 120,
    'max_alerts_per_subscription' => 20,

    // Market drop or rally: total market cap over 24h, or BTC over 4h.
    'market' => [
        'market_cap_24h_pct' => 5.0,
        'btc_4h_pct' => 7.0,
        // One alert per direction in this window, however long the move lasts.
        'cooldown_hours' => 12,
    ],

    // A brief more than this late (the server slept through its time) is
    // skipped for the day rather than arriving in the afternoon.
    'brief_late_after_minutes' => 180,

    // Sent alerts kept for the in-app history.
    'history_days' => 30,

    // Price alerts that already fired, kept so the list can show them.
    'triggered_alert_days' => 30,
];
