<?php

use App\Http\Controllers\Api\V1\SettingController;
use App\Http\Controllers\Api\V1\WhatsAppController;
use Illuminate\Support\Facades\Route;

Route::get('/settings', [SettingController::class, 'index'])
    ->middleware('permission:settings.manage');

Route::get('/settings/whatsapp-templates', [SettingController::class, 'whatsappTemplates'])
    ->middleware('permission:members.view|subscriptions.view|reports.view|settings.manage');

Route::put('/settings', [SettingController::class, 'update'])
    ->middleware('permission:settings.manage');

// Linking the gym's WhatsApp number. Restricted to settings.manage: the QR pairs
// a device to the gym's WhatsApp account, so anyone who can read it can read the
// gym's conversations.
Route::prefix('/settings/whatsapp')
    ->middleware('permission:settings.manage')
    ->group(function () {
        Route::get('/connection', [WhatsAppController::class, 'connection']);
        Route::get('/qr', [WhatsAppController::class, 'qr']);
        Route::post('/logout', [WhatsAppController::class, 'logout']);
    });
