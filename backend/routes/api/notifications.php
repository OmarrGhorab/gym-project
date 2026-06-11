<?php

use App\Http\Controllers\Api\V1\NotificationController;
use App\Support\MembershipPermissions;
use Illuminate\Support\Facades\Route;

Route::prefix('notifications')->middleware('permission:'.MembershipPermissions::PERM_NOTIFICATIONS_VIEW)->group(function (): void {
    Route::get('/', [NotificationController::class, 'index']);
    Route::post('/{notification}/read', [NotificationController::class, 'markRead'])
        ->middleware('throttle:api');
});
