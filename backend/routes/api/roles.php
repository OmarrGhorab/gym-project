<?php

use App\Http\Controllers\Api\V1\PermissionController;
use App\Http\Controllers\Api\V1\RoleController;
use App\Http\Controllers\Api\V1\UserRoleController;
use Illuminate\Support\Facades\Route;

Route::middleware(['permission:roles.manage'])->group(function (): void {
    Route::get('permissions', [PermissionController::class, 'index']);

    Route::apiResource('roles', RoleController::class);

    Route::post('users/{user}/roles', [UserRoleController::class, 'store'])
        ->middleware('throttle:api');
});
