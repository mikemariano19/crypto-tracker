<?php

return [

    'paths' => ['api/*'],

    // The API is read-only.
    'allowed_methods' => ['GET', 'HEAD', 'OPTIONS'],

    // Comma-separated list, e.g. FRONTEND_URLS=https://app.example.com
    'allowed_origins' => array_filter(array_map('trim', explode(
        ',',
        env('FRONTEND_URLS', 'http://localhost:3000,http://192.168.1.15:3000')
    ))),

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['Accept', 'Content-Type', 'If-None-Match'],

    'exposed_headers' => ['ETag'],

    // Cache preflight results for a day.
    'max_age' => 86400,

    // Public market data only: no cookies or auth headers are sent.
    'supports_credentials' => false,

];
