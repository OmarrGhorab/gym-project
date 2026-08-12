<?php

use App\Http\Controllers\Api\V1\SubscriptionController;
use App\Support\MembershipPermissions;
use Illuminate\Support\Facades\Route;

Route::prefix('subscriptions')->group(function (): void {
    Route::get('/', [SubscriptionController::class, 'index'])
        ->middleware('permission:'.MembershipPermissions::PERM_SUBSCRIPTIONS_VIEW);

    Route::post('/', [SubscriptionController::class, 'store'])
        ->middleware(['throttle:api', 'permission:'.MembershipPermissions::PERM_SUBSCRIPTIONS_CREATE]);

    Route::get('/summary', [SubscriptionController::class, 'summary'])
        ->middleware('permission:'.MembershipPermissions::PERM_SUBSCRIPTIONS_VIEW);

    Route::get('/{subscription}', [SubscriptionController::class, 'show'])
        ->middleware('permission:'.MembershipPermissions::PERM_SUBSCRIPTIONS_VIEW);

    // Corrects a membership rung up wrong — dates and price only, never the
    // payments already collected against it.
    Route::patch('/{subscription}', [SubscriptionController::class, 'update'])
        ->middleware(['throttle:api', 'permission:'.MembershipPermissions::PERM_SUBSCRIPTIONS_UPGRADE]);

    Route::post('/{subscription}/renew', [SubscriptionController::class, 'renew'])
        ->middleware(['throttle:api', 'permission:'.MembershipPermissions::PERM_SUBSCRIPTIONS_RENEW]);

    Route::post('/{subscription}/upgrade', [SubscriptionController::class, 'upgrade'])
        ->middleware(['throttle:api', 'permission:'.MembershipPermissions::PERM_SUBSCRIPTIONS_UPGRADE]);

    Route::post('/{subscription}/addons', [SubscriptionController::class, 'addAddon'])
        ->middleware(['throttle:api', 'permission:'.MembershipPermissions::PERM_SUBSCRIPTIONS_UPGRADE]);

    Route::post('/{subscription}/addons/{addon}/cancel', [SubscriptionController::class, 'cancelAddon'])
        ->middleware(['throttle:api', 'permission:'.MembershipPermissions::PERM_SUBSCRIPTIONS_STOP]);

    Route::post('/{subscription}/freeze', [SubscriptionController::class, 'freeze'])
        ->middleware(['throttle:api', 'permission:'.MembershipPermissions::PERM_SUBSCRIPTIONS_FREEZE]);

    Route::post('/{subscription}/unfreeze', [SubscriptionController::class, 'unfreeze'])
        ->middleware(['throttle:api', 'permission:'.MembershipPermissions::PERM_SUBSCRIPTIONS_FREEZE]);

    Route::post('/{subscription}/stop', [SubscriptionController::class, 'stop'])
        ->middleware(['throttle:api', 'permission:'.MembershipPermissions::PERM_SUBSCRIPTIONS_STOP]);

    Route::post('/{subscription}/cancel', [SubscriptionController::class, 'cancel'])
        ->middleware(['throttle:api', 'permission:'.MembershipPermissions::PERM_SUBSCRIPTIONS_STOP]);
});
