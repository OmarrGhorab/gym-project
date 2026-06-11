<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Universal Data Export Config
    |--------------------------------------------------------------------------
    |
    | threshold: below this row count, exports are served immediately in sync.
    | disk: where queued export files are temporarily stored.
    | retention_hours: how long export files are kept before being pruned.
    |
    */
    'sync_threshold' => (int) env('EXPORT_SYNC_THRESHOLD', 5000),
    'disk' => env('EXPORT_DISK', 'local'),
    'retention_hours' => (int) env('EXPORT_RETENTION_HOURS', 24),
];
