<?php

use App\Http\Controllers\Api\V1\OvertimeShiftController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Overtime shift routes — /api/v1/overtime-shifts
|--------------------------------------------------------------------------
|
| Extra shifts picked up when the assigned employee did not attend. The bonus
| is approved with a hand-entered amount and added to payroll manually.
|
*/

Route::prefix('overtime-shifts')->group(function (): void {
    Route::get('/', [OvertimeShiftController::class, 'index'])
        ->middleware('permission:attendance.view');

    Route::get('/candidates', [OvertimeShiftController::class, 'candidates'])
        ->middleware('permission:attendance.view');

    Route::get('/summary', [OvertimeShiftController::class, 'summary'])
        ->middleware('permission:attendance.view|payroll.view');

    Route::post('/', [OvertimeShiftController::class, 'store'])
        ->middleware(['permission:attendance.update', 'throttle:api']);

    Route::put('/{overtimeShift}', [OvertimeShiftController::class, 'review'])
        ->middleware(['permission:attendance.update', 'throttle:api']);

    Route::delete('/{overtimeShift}', [OvertimeShiftController::class, 'destroy'])
        ->middleware(['permission:attendance.delete', 'throttle:api']);
});
