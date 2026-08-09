<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    // Realtime / broadcast readiness configuration.
    // Used by CheckInfrastructureReadiness and later phases that publish
    // server-sent events or WebSocket broadcasts (e.g. live dashboard updates).
    // All credentials are env-only — no secrets in code (Constitution §V).
    // Set REALTIME_DRIVER to 'reverb' (Laravel Reverb) or 'pusher' in production;
    // leave unset (null) for local/test environments where broadcasting is disabled.
    'realtime' => [
        'driver' => env('REALTIME_DRIVER'),
        'app_id' => env('REVERB_APP_ID'),
        'app_key' => env('REVERB_APP_KEY'),
        'app_secret' => env('REVERB_APP_SECRET'),
        'host' => env('REVERB_HOST', '0.0.0.0'),
        'port' => (int) env('REVERB_PORT', 8080),
        'scheme' => env('REVERB_SCHEME', 'http'),
    ],

    'messaging' => [
        'driver' => env('MESSAGING_DRIVER'),
    ],

    // Local WhatsApp gateway (see whatsapp-service/ at the repo root). It holds
    // the gym's linked WhatsApp session and sends on our behalf, replacing the
    // manual "open wa.me and press send" step.
    //
    // `enabled` is an env-level kill switch, deliberately separate from the
    // per-event toggles in the settings table: local and staging share the
    // production database dump, and must never message real members because of
    // a toggle someone flipped in the dashboard.
    'whatsapp' => [
        'url' => env('WHATSAPP_SERVICE_URL'),
        'token' => env('WHATSAPP_SERVICE_TOKEN'),
        'enabled' => filter_var(env('WHATSAPP_AUTO_SEND', false), FILTER_VALIDATE_BOOL),
        // Generous: the gateway throttles sends 5–20s apart and a message may
        // wait behind others in its queue.
        'timeout' => (int) env('WHATSAPP_SERVICE_TIMEOUT', 90),
    ],

    // Social login provider (Laravel Socialite).
    // Credentials are env-only; keep client secrets out of version control.
    // Only Google is enabled; the API rejects all other providers.
    'google' => [
        'client_id' => env('GOOGLE_CLIENT_ID'),
        'client_secret' => env('GOOGLE_CLIENT_SECRET'),
        'redirect' => env('GOOGLE_REDIRECT_URI'),
    ],

];
