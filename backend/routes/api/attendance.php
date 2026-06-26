<?php

use App\Http\Controllers\Api\V1\AttendanceController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Attendance routes — /api/v1/attendance
|--------------------------------------------------------------------------
*/

Route::prefix('attendance')->group(function (): void {
    Route::get('/', [AttendanceController::class, 'index'])
        ->middleware('permission:attendance.view');

    Route::get('/summary', [AttendanceController::class, 'summary'])
        ->middleware('permission:attendance.view');

    Route::post('/', [AttendanceController::class, 'store'])
        ->middleware(['permission:attendance.create', 'throttle:api']);

    Route::get('/{attendance}', [AttendanceController::class, 'show'])
        ->middleware('permission:attendance.view');

    Route::put('/{attendance}', [AttendanceController::class, 'update'])
        ->middleware(['permission:attendance.update', 'throttle:api']);

    Route::delete('/{attendance}', [AttendanceController::class, 'destroy'])
        ->middleware(['permission:attendance.delete', 'throttle:api']);
});
