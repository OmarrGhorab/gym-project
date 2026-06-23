<?php

use App\Http\Controllers\Api\V1\PlanController;
use App\Support\MembershipPermissions;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Plans routes — /api/v1/plans
|--------------------------------------------------------------------------
|
| Registered inside the /api/v1 prefix group defined in routes/api.php.
| All endpoints require auth:sanctum (inherited from the outer group).
| Authorization is enforced per-route via permission middleware and the
| PlanPolicy (US2 — T036).
|
*/

Route::prefix('plans')->group(function (): void {
    Route::get('/', [PlanController::class, 'index'])
        ->middleware('permission:'.MembershipPermissions::PERM_PLANS_VIEW);

    Route::post('/', [PlanController::class, 'store'])
        ->middleware(['throttle:api', 'permission:'.MembershipPermissions::PERM_PLANS_CREATE]);

    Route::get('/{plan}', [PlanController::class, 'show'])
        ->middleware('permission:'.MembershipPermissions::PERM_PLANS_VIEW);

    Route::put('/{plan}', [PlanController::class, 'update'])
        ->middleware(['throttle:api', 'permission:'.MembershipPermissions::PERM_PLANS_UPDATE]);

    Route::patch('/{plan}/toggle', [PlanController::class, 'toggle'])
        ->middleware(['throttle:api', 'permission:'.MembershipPermissions::PERM_PLANS_UPDATE]);
});
