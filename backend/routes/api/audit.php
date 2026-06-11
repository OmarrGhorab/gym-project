<?php

use App\Http\Controllers\Api\V1\AuditLogController;
use Illuminate\Support\Facades\Route;

Route::middleware(['permission:audit.view'])->group(function (): void {
    Route::get('audit-logs', [AuditLogController::class, 'index']);
});
