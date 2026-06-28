<?php

use App\Http\Controllers\Api\V1\ReportController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Reports routes — /api/v1/reports
|--------------------------------------------------------------------------
*/

Route::prefix('reports')->group(function (): void {
    Route::get('/financial', [ReportController::class, 'financial'])
        ->middleware('permission:reports.view');

    Route::get('/finance-summary', [ReportController::class, 'financeSummary'])
        ->middleware('permission:reports.view');

    Route::get('/employees', [ReportController::class, 'employees'])
        ->middleware('permission:reports.view');
});
