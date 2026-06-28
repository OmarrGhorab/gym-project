<?php

use App\Http\Controllers\Api\V1\MemberVisitController;
use Illuminate\Support\Facades\Route;

Route::prefix('member-visits')->group(function (): void {
    Route::get('/', [MemberVisitController::class, 'index'])
        ->middleware('permission:members.view');

    Route::post('/check-in', [MemberVisitController::class, 'checkIn'])
        ->middleware(['permission:members.update', 'throttle:api']);

    Route::post('/check-out', [MemberVisitController::class, 'checkOut'])
        ->middleware(['permission:members.update', 'throttle:api']);

    Route::post('/', [MemberVisitController::class, 'store'])
        ->middleware(['permission:members.update', 'throttle:api']);

    Route::get('/{memberVisit}', [MemberVisitController::class, 'show'])
        ->middleware('permission:members.view');

    Route::put('/{memberVisit}', [MemberVisitController::class, 'update'])
        ->middleware(['permission:members.update', 'throttle:api']);

    Route::delete('/{memberVisit}', [MemberVisitController::class, 'destroy'])
        ->middleware(['permission:members.delete', 'throttle:api']);
});
