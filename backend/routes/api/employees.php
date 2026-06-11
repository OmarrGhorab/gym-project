<?php

use App\Http\Controllers\Api\V1\CommissionController;
use App\Http\Controllers\Api\V1\EmployeeController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Employees routes — /api/v1/employees
|--------------------------------------------------------------------------
*/

Route::prefix('employees')->group(function (): void {
    Route::get('/', [EmployeeController::class, 'index'])
        ->middleware('permission:employees.view');

    Route::post('/', [EmployeeController::class, 'store'])
        ->middleware(['permission:employees.create', 'throttle:api']);

    Route::get('/{employee}', [EmployeeController::class, 'show'])
        ->middleware('permission:employees.view');

    Route::put('/{employee}', [EmployeeController::class, 'update'])
        ->middleware(['permission:employees.update', 'throttle:api']);

    Route::delete('/{employee}', [EmployeeController::class, 'destroy'])
        ->middleware(['permission:employees.delete', 'throttle:api']);

    Route::get('/{employee}/commissions', [CommissionController::class, 'index'])
        ->middleware('permission:commissions.view');

    Route::get('/{employee}/performance', [EmployeeController::class, 'performance'])
        ->middleware('permission:reports.view');
});
