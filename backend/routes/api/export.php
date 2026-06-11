<?php

use App\Http\Controllers\Api\V1\ExportController;
use Illuminate\Support\Facades\Route;

Route::get('/export/download/{exportId}', [ExportController::class, 'download'])
    ->name('export.download')
    ->middleware(['signed', 'can:download-export,exportId']);

Route::get('/export/status/{exportId}', [ExportController::class, 'status'])
    ->name('export.status')
    ->middleware(['throttle:export', 'can:download-export,exportId']);

Route::get('/export/{resource}', [ExportController::class, 'export'])
    ->middleware(['throttle:export', 'can:export-resource,resource']);
