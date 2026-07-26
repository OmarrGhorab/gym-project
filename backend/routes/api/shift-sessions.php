<?php

use App\Http\Controllers\Api\V1\ShiftSessionController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Shift session routes — /api/v1/shift-sessions
|--------------------------------------------------------------------------
|
| Registered inside the /api/v1 + auth:sanctum group defined in routes/api.php.
|
| The shift desk is shared by finance/attendance staff, so these endpoints are
| gated on ANY of the relevant permissions rather than a single one. The route
| middleware below mirrors ShiftSessionController's own guards exactly:
|   - read  : authorizeFinanceView()   -> expenses.view|attendance.view|payments.view
|   - write : authorizeFinanceCreate() -> expenses.create|attendance.create|payments.create
|   - review: settings.manage|expenses.update|expenses.create, or the Admin role
| The controller keeps its checks (defence in depth); the middleware makes the
| gate visible to route-level tooling without narrowing who may call them.
|
*/

Route::prefix('shift-sessions')->group(function (): void {
    $view = 'permission:expenses.view|attendance.view|payments.view';
    $write = 'permission:expenses.create|attendance.create|payments.create';

    Route::get('/', [ShiftSessionController::class, 'index'])
        ->middleware($view);

    Route::get('/current', [ShiftSessionController::class, 'current'])
        ->middleware($view);

    Route::get('/options', [ShiftSessionController::class, 'shiftOptions'])
        ->middleware($view);

    Route::post('/', [ShiftSessionController::class, 'store'])
        ->middleware($write);

    Route::post('/{shiftSession}/close', [ShiftSessionController::class, 'close'])
        ->middleware($write);

    // Hand the open drawer to another employee of the same shift.
    Route::put('/{shiftSession}/staff', [ShiftSessionController::class, 'assignStaff'])
        ->middleware($write);

    Route::post('/{shiftSession}/handover', [ShiftSessionController::class, 'handover'])
        ->middleware($write);

    // Admin role is an explicit fallback here: review rights are usually granted
    // through settings/expenses permissions, but an Admin always reviews.
    Route::post('/{shiftSession}/review', [ShiftSessionController::class, 'review'])
        ->middleware('role_or_permission:settings.manage|expenses.update|expenses.create|Admin');
});
