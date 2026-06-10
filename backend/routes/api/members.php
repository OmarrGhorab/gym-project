<?php

use App\Http\Controllers\Api\V1\MemberController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Members routes — /api/v1/members
|--------------------------------------------------------------------------
|
| Registered inside the /api/v1 + auth:sanctum group defined in routes/api.php.
| Individual routes add permission middleware where required.
| Write-mutating routes are throttled via throttle:api.
|
*/

Route::prefix('members')->group(function (): void {

    Route::get('/', [MemberController::class, 'index'])
        ->middleware('permission:members.view');

    Route::post('/', [MemberController::class, 'store'])
        ->middleware(['permission:members.create', 'throttle:api']);

    Route::get('/{member}', [MemberController::class, 'show'])
        ->middleware('permission:members.view');

    Route::put('/{member}', [MemberController::class, 'update'])
        ->middleware(['permission:members.update', 'throttle:api']);

    Route::delete('/{member}', [MemberController::class, 'destroy'])
        ->middleware(['permission:members.delete', 'throttle:api']);

    Route::post('/{member}/photo', [MemberController::class, 'uploadPhoto'])
        ->middleware(['permission:members.update', 'throttle:api']);

    Route::get('/{member}/photo', [MemberController::class, 'streamPhoto'])
        ->middleware('permission:members.view');

    Route::get('/{member}/payments', [MemberController::class, 'payments'])
        ->middleware('permission:payments.view');
});
