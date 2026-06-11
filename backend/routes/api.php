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
| Per-area route files live in routes/api/ and are required below inside
| the single /api/v1 group.  Each story/area owns its own file:
|
|   routes/api/members.php        — US1 Members
|   routes/api/plans.php          — US2 Plans
|   routes/api/subscriptions.php  — US3 Subscriptions + US4 Freeze/Stop
|   routes/api/payments.php       — US5 Payments
|   routes/api/notifications.php  — US6 Notifications
|   routes/api/dashboard.php      — US7 Dashboard
|
| Stub files are present so the requires below never fail even before the
| area's routes are implemented.  Each stub file contains only a comment.
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

    // ------------------------------------------------------------------
    // Phase 1 per-area routes — included under the same /api/v1 prefix.
    // Auth middleware is declared inside each file or inherited here.
    // All areas require authentication; public health/auth above opt out.
    // ------------------------------------------------------------------
    Route::middleware('auth:sanctum')->group(function (): void {
        require __DIR__.'/api/members.php';
        require __DIR__.'/api/plans.php';
        require __DIR__.'/api/subscriptions.php';
        require __DIR__.'/api/payments.php';
        require __DIR__.'/api/notifications.php';
        require __DIR__.'/api/dashboard.php';
        require __DIR__.'/api/products.php';
        require __DIR__.'/api/sales.php';
    });
});
