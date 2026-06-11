<?php

use App\Http\Controllers\Api\V1\ProductController;
use Illuminate\Support\Facades\Route;

Route::prefix('products')->group(function (): void {
    Route::get('/', [ProductController::class, 'index'])
        ->middleware('permission:products.view');

    Route::post('/', [ProductController::class, 'store'])
        ->middleware(['throttle:api', 'permission:products.create']);

    Route::get('/{product}', [ProductController::class, 'show'])
        ->middleware('permission:products.view');

    Route::put('/{product}', [ProductController::class, 'update'])
        ->middleware(['throttle:api', 'permission:products.update']);

    Route::patch('/{product}/toggle', [ProductController::class, 'toggle'])
        ->middleware(['throttle:api', 'permission:products.update']);

    Route::post('/{product}/stock', [ProductController::class, 'adjustStock'])
        ->middleware(['throttle:api', 'permission:inventory.adjust']);

    Route::get('/{product}/image', [ProductController::class, 'streamImage'])
        ->middleware('permission:products.view');
});
