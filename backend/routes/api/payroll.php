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

    // Not payroll.view: an employee may always pull their OWN payslip. The
    // PayrollPolicy@view check (payroll.view permission OR owning employee) is
    // the real gate, declared here so it is enforced before the controller too.
    Route::get('/{payroll}/payslip', [PayrollController::class, 'payslip'])
        ->middleware(['can:view,payroll', 'throttle:api']);
});
