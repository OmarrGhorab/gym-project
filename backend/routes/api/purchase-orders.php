<?php

use App\Http\Controllers\Api\V1\PurchaseOrderController;
use Illuminate\Support\Facades\Route;

Route::prefix('purchase-orders')->group(function (): void {
    Route::get('/', [PurchaseOrderController::class, 'index'])
        ->middleware('permission:products.view');

    Route::post('/', [PurchaseOrderController::class, 'store'])
        ->middleware(['permission:inventory.adjust', 'throttle:api']);

    Route::get('/{purchaseOrder}', [PurchaseOrderController::class, 'show'])
        ->middleware('permission:products.view');

    Route::post('/{purchaseOrder}/receive', [PurchaseOrderController::class, 'receive'])
        ->middleware(['permission:inventory.adjust', 'throttle:api']);
});
