<?php

use App\Http\Controllers\Api\V1\CommissionController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Commissions routes — /api/v1/commissions
|--------------------------------------------------------------------------
*/

Route::prefix('commissions')->group(function (): void {
    Route::post('/backfill', [CommissionController::class, 'backfill'])
        ->middleware(['permission:commissions.backfill', 'throttle:api']);
});
