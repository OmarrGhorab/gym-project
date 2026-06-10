<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Default Filesystem Disk
    |--------------------------------------------------------------------------
    |
    | Here you may specify the default filesystem disk that should be used
    | by the framework. The "local" disk, as well as a variety of cloud
    | based disks are available to your application for file storage.
    |
    */

    'default' => env('FILESYSTEM_DISK', 'local'),

    /*
    |--------------------------------------------------------------------------
    | Filesystem Disks
    |--------------------------------------------------------------------------
    |
    | Below you may configure as many filesystem disks as necessary, and you
    | may even configure multiple disks for the same driver. Examples for
    | most supported storage drivers are configured here for reference.
    |
    | Supported drivers: "local", "ftp", "sftp", "s3"
    |
    */

    'disks' => [

        // Member photos (and other private media) MUST use a private disk —
        // either 'local' (storage_path('app/private')) or 'remote' in
        // production — so files are never directly web-accessible.
        // Access is gated by a Policy-authorised stream route (US1, SEC-M3).
        // Do NOT store member photos on the 'public' disk or serve them via a
        // public URL; all reads flow through an authorised controller action.
        'local' => [
            'driver' => 'local',
            'root' => storage_path('app/private'),
            'serve' => true,
            'throw' => false,
            'report' => false,
        ],

        'public' => [
            'driver' => 'local',
            'root' => storage_path('app/public'),
            'url' => rtrim(env('APP_URL', 'http://localhost'), '/').'/storage',
            'visibility' => 'public',
            'throw' => false,
            'report' => false,
        ],

        's3' => [
            'driver' => 's3',
            'key' => env('AWS_ACCESS_KEY_ID'),
            'secret' => env('AWS_SECRET_ACCESS_KEY'),
            'region' => env('AWS_DEFAULT_REGION'),
            'bucket' => env('AWS_BUCKET'),
            'url' => env('AWS_URL'),
            'endpoint' => env('AWS_ENDPOINT'),
            'use_path_style_endpoint' => env('AWS_USE_PATH_STYLE_ENDPOINT', false),
            'throw' => false,
            'report' => false,
        ],

        // Remote-compatible disk used by later phases for media uploads, exports,
        // and report storage. Backed by an S3-compatible provider; all credentials
        // are env-only (Constitution §V). Point REMOTE_DISK_DRIVER to 's3' in
        // production and keep 'local' for local/test environments.
        'remote' => ['driver' => env('REMOTE_DISK_DRIVER', 'local'),
            'key' => env('REMOTE_DISK_KEY'),
            'secret' => env('REMOTE_DISK_SECRET'),
            'region' => env('REMOTE_DISK_REGION'),
            'bucket' => env('REMOTE_DISK_BUCKET'),
            'url' => env('REMOTE_DISK_URL'),
            'endpoint' => env('REMOTE_DISK_ENDPOINT'),
            'use_path_style_endpoint' => env('REMOTE_DISK_PATH_STYLE', false),
            'root' => env('REMOTE_DISK_ROOT', storage_path('app/remote')),
            'throw' => false,
            'report' => false,
        ],

    ],

    /*
    |--------------------------------------------------------------------------
    | Symbolic Links
    |--------------------------------------------------------------------------
    |
    | Here you may configure the symbolic links that will be created when the
    | `storage:link` Artisan command is executed. The array keys should be
    | the locations of the links and the values should be their targets.
    |
    */

    'links' => [
        public_path('storage') => storage_path('app/public'),
    ],

];
