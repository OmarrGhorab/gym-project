<?php

use App\Http\Controllers\Api\V1\DashboardController;
use App\Support\MembershipPermissions;
use Illuminate\Support\Facades\Route;

Route::prefix('dashboard')->group(function (): void {
    Route::middleware('permission:'.MembershipPermissions::PERM_DASHBOARD_VIEW)->group(function (): void {
        Route::get('/active-subscriptions', [DashboardController::class, 'activeSubscriptions']);
        Route::get('/expiring-soon', [DashboardController::class, 'expiringSoon']);
    });

    Route::middleware('permission:reports.view')->group(function (): void {
        Route::get('/sales-today', [DashboardController::class, 'salesToday']);
        Route::get('/top-products', [DashboardController::class, 'topProducts']);
        Route::get('/summary', [DashboardController::class, 'summary']);
    });
});
