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

    Route::get('/daily-report', [AttendanceController::class, 'dailyReport'])
        ->middleware('permission:attendance.view');

    Route::get('/shifts', [AttendanceController::class, 'shifts'])
        ->middleware('permission:attendance.view');

    Route::get('/employee-options', [AttendanceController::class, 'employeeOptions'])
        ->middleware('permission:attendance.view');

    Route::get('/shifts/manage', [AttendanceController::class, 'manageShifts'])
        ->middleware('permission:settings.manage');

    Route::post('/shifts', [AttendanceController::class, 'storeShift'])
        ->middleware(['permission:settings.manage', 'throttle:api']);

    Route::put('/shifts/{employeeShift}', [AttendanceController::class, 'updateShift'])
        ->middleware(['permission:settings.manage', 'throttle:api']);

    Route::delete('/shifts/{employeeShift}', [AttendanceController::class, 'deactivateShift'])
        ->middleware(['permission:settings.manage', 'throttle:api']);

    Route::post('/check-in', [AttendanceController::class, 'checkIn'])
        ->middleware(['permission:attendance.create', 'throttle:api']);

    Route::post('/check-out', [AttendanceController::class, 'checkOut'])
        ->middleware(['permission:attendance.create', 'throttle:api']);

    Route::post('/', [AttendanceController::class, 'store'])
        ->middleware(['permission:attendance.create', 'throttle:api']);

    Route::get('/{attendance}', [AttendanceController::class, 'show'])
        ->middleware('permission:attendance.view');

    Route::put('/{attendance}', [AttendanceController::class, 'update'])
        ->middleware(['permission:attendance.update', 'throttle:api']);

    Route::delete('/{attendance}', [AttendanceController::class, 'destroy'])
        ->middleware(['permission:attendance.delete', 'throttle:api']);
});
