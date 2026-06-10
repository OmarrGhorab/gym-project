<?php

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\Foundation\ProtectedSampleController;
use App\Http\Controllers\Api\V1\HealthController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes — /api/v1
|--------------------------------------------------------------------------
|
| All routes are prefixed /api/v1 and follow the stable response envelope
| { data, meta, message } for success and { error: { code, message,
| details } } for errors.
|
| Public  : no auth middleware
| Protected: auth:sanctum middleware applied per group or route
|
*/

Route::prefix('v1')->group(function (): void {

    // ------------------------------------------------------------------
    // US1 — Health check (public)
    // ------------------------------------------------------------------
    Route::get('health', [HealthController::class, 'index']);

    // ------------------------------------------------------------------
    // US2 — Authentication (public + protected)
    // ------------------------------------------------------------------
    Route::prefix('auth')->group(function (): void {
        // Rate-limit login to reduce brute-force exposure.
        Route::post('login', [AuthController::class, 'login'])
            ->middleware('throttle:auth');

        Route::middleware('auth:sanctum')->group(function (): void {
            Route::get('me', [AuthController::class, 'me']);
            Route::post('logout', [AuthController::class, 'logout'])
                ->middleware('throttle:api');
        });
    });

    // ------------------------------------------------------------------
    // US3 — Role/permission sample (protected + permission-gated)
    // ------------------------------------------------------------------
    Route::middleware(['auth:sanctum'])->group(function (): void {
        Route::get(
            'foundation/protected-sample',
            [ProtectedSampleController::class, 'index'],
        )->middleware('permission:foundation.access-sample');
    });
});
