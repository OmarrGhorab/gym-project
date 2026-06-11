<?php

use App\Http\Controllers\Api\V1\DashboardController;
use App\Support\MembershipPermissions;
use Illuminate\Support\Facades\Route;

Route::prefix('dashboard')->middleware('permission:'.MembershipPermissions::PERM_DASHBOARD_VIEW)->group(function (): void {
    Route::get('/active-subscriptions', [DashboardController::class, 'activeSubscriptions']);
    Route::get('/expiring-soon', [DashboardController::class, 'expiringSoon']);
});
