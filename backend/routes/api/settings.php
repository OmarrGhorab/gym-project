<?php

use App\Http\Controllers\Api\V1\SettingController;
use Illuminate\Support\Facades\Route;

Route::get('/settings', [SettingController::class, 'index'])
    ->middleware('permission:settings.manage');

Route::get('/settings/whatsapp-templates', [SettingController::class, 'whatsappTemplates'])
    ->middleware('permission:members.view|subscriptions.view|reports.view|settings.manage');

Route::put('/settings', [SettingController::class, 'update'])
    ->middleware('permission:settings.manage');
