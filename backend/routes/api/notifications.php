<?php

use App\Http\Controllers\Api\V1\NotificationController;
use Illuminate\Support\Facades\Route;

Route::prefix('notifications')->group(function (): void {
    Route::get('/', [NotificationController::class, 'index']);
    Route::post('/{notification}/read', [NotificationController::class, 'markRead']);
});
