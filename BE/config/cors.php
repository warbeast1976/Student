<?php

return [
    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    // For local JS/HTML/CSS, allow all origins by default.
    // Lock this down in production (set CORS_ALLOWED_ORIGINS).
    'allowed_origins' => array_filter(explode(',', env('CORS_ALLOWED_ORIGINS', '*'))),

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => false,
];

