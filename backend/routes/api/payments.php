<?php

use App\Http\Controllers\Api\V1\PaymentController;
use App\Support\MembershipPermissions;
use Illuminate\Support\Facades\Route;

Route::prefix('payments')->group(function (): void {
    Route::get('/', [PaymentController::class, 'index'])
        ->middleware('permission:'.MembershipPermissions::PERM_PAYMENTS_VIEW);

    Route::post('/', [PaymentController::class, 'store'])
        ->middleware(['throttle:api', 'permission:'.MembershipPermissions::PERM_PAYMENTS_CREATE]);
});
