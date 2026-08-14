<?php

use App\Http\Controllers\Api\V1\EmployeeAbsenceController;
use Illuminate\Support\Facades\Route;

Route::prefix('employee-absences')
    ->middleware('permission:payroll.generate')
    ->group(function (): void {
        Route::get('/', [EmployeeAbsenceController::class, 'index']);
        Route::post('/', [EmployeeAbsenceController::class, 'store'])->middleware('throttle:api');
        Route::put('/{absence}', [EmployeeAbsenceController::class, 'update'])->middleware('throttle:api');
        Route::delete('/{absence}', [EmployeeAbsenceController::class, 'destroy'])->middleware('throttle:api');
    });
