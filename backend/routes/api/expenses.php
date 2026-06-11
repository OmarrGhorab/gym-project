<?php

use App\Http\Controllers\Api\V1\ExpenseController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Expenses routes — /api/v1/expenses
|--------------------------------------------------------------------------
*/

Route::prefix('expenses')->group(function (): void {
    Route::get('/', [ExpenseController::class, 'index'])
        ->middleware('permission:expenses.view');

    Route::post('/', [ExpenseController::class, 'store'])
        ->middleware(['permission:expenses.create', 'throttle:api']);

    Route::get('/{expense}', [ExpenseController::class, 'show'])
        ->middleware('permission:expenses.view');

    Route::put('/{expense}', [ExpenseController::class, 'update'])
        ->middleware(['permission:expenses.update', 'throttle:api']);

    Route::delete('/{expense}', [ExpenseController::class, 'destroy'])
        ->middleware(['permission:expenses.delete', 'throttle:api']);
});
