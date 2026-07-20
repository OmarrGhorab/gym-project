<?php

use App\Http\Controllers\Api\V1\ShiftSessionController;
use Illuminate\Support\Facades\Route;

Route::prefix('shift-sessions')->group(function (): void {
    Route::get('/', [ShiftSessionController::class, 'index']);
    Route::get('/current', [ShiftSessionController::class, 'current']);
    Route::get('/options', [ShiftSessionController::class, 'shiftOptions']);
    Route::post('/', [ShiftSessionController::class, 'store']);
    Route::post('/{shiftSession}/close', [ShiftSessionController::class, 'close']);
    Route::post('/{shiftSession}/handover', [ShiftSessionController::class, 'handover']);
    Route::post('/{shiftSession}/review', [ShiftSessionController::class, 'review']);
});
