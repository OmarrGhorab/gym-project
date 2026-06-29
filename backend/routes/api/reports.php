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

    Route::get('/live-attendance', [ReportController::class, 'liveAttendance'])
        ->middleware('permission:reports.view');

    Route::get('/operations-summary', [ReportController::class, 'operationsSummary'])
        ->middleware('permission:reports.view');

    Route::get('/pos-summary', [ReportController::class, 'posSummary'])
        ->middleware('permission:reports.view');

    Route::get('/staff-academy', [ReportController::class, 'staffAcademy'])
        ->middleware('permission:reports.view');

    Route::get('/inventory-logistics', [ReportController::class, 'inventoryLogistics'])
        ->middleware('permission:reports.view');

    Route::get('/system-health', [ReportController::class, 'systemHealth'])
        ->middleware('permission:reports.view');

    Route::post('/operations-calendar-events', [ReportController::class, 'storeOperationsCalendarEvent'])
        ->middleware('permission:reports.view');

    Route::get('/employees', [ReportController::class, 'employees'])
        ->middleware('permission:reports.view');
});
