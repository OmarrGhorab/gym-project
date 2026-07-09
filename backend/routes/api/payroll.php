<?php

use App\Http\Controllers\Api\V1\PayrollController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Payroll routes — /api/v1/payroll
|--------------------------------------------------------------------------
*/

Route::prefix('payroll')->group(function (): void {
    Route::get('/', [PayrollController::class, 'index'])
        ->middleware('permission:payroll.view');

    Route::post('/generate', [PayrollController::class, 'generate'])
        ->middleware(['permission:payroll.generate', 'throttle:sensitive']);

    Route::put('/{payroll}', [PayrollController::class, 'update'])
        ->middleware(['permission:payroll.generate', 'throttle:api']);

    Route::post('/{payroll}/pay', [PayrollController::class, 'pay'])
        ->middleware(['permission:payroll.pay', 'throttle:sensitive']);

    Route::get('/{payroll}/payslip', [PayrollController::class, 'payslip'])
        ->middleware('throttle:api');
});
