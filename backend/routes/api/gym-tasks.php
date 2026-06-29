<?php

use App\Http\Controllers\Api\V1\GymTaskController;
use Illuminate\Support\Facades\Route;

Route::prefix('gym-tasks')->group(function (): void {
    Route::get('/', [GymTaskController::class, 'index'])
        ->middleware('permission:reports.view');

    Route::post('/', [GymTaskController::class, 'store'])
        ->middleware(['permission:reports.view', 'throttle:api']);

    Route::put('/{gymTask}', [GymTaskController::class, 'update'])
        ->middleware(['permission:reports.view', 'throttle:api']);

    Route::delete('/{gymTask}', [GymTaskController::class, 'destroy'])
        ->middleware(['permission:reports.view', 'throttle:api']);
});
