<?php

use App\Http\Controllers\Api\V1\SaleController;
use Illuminate\Support\Facades\Route;

Route::prefix('sales')->group(function (): void {
    Route::get('/daily', [SaleController::class, 'daily'])
        ->middleware('permission:reports.view');

    Route::get('/report', [SaleController::class, 'report'])
        ->middleware('permission:reports.view');

    Route::get('/', [SaleController::class, 'index'])
        ->middleware('permission:sales.view');

    Route::post('/', [SaleController::class, 'store'])
        ->middleware(['throttle:api', 'permission:sales.create']);

    Route::get('/{sale}', [SaleController::class, 'show'])
        ->middleware('permission:sales.view');

    Route::post('/{sale}/void', [SaleController::class, 'void'])
        ->middleware(['throttle:api', 'permission:sales.void']);

    Route::get('/{sale}/receipt', [SaleController::class, 'receipt'])
        ->middleware('permission:sales.view');
});
