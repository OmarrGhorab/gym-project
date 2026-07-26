<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Settings\StoreSetting;
use App\Actions\Settings\UpdateSettings;
use App\Http\Requests\Settings\IndexSettingsRequest;
use App\Http\Requests\Settings\UpdateSettingsRequest;
use App\Http\Resources\SettingResource;
use App\Models\Setting;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;

class SettingController extends ApiController
{
    public function index(IndexSettingsRequest $request): JsonResponse
    {
        $settings = Cache::rememberForever('settings.all', fn () => Setting::all()->pluck('value', 'key')->toArray());

        return (new SettingResource($settings))
            ->withMessage('Settings retrieved successfully')
            ->response();
    }

    public function update(UpdateSettingsRequest $request, UpdateSettings $action): JsonResponse
    {
        $validated = $request->validated();

        $logoPath = null;
        if (isset($validated['gym']) && $request->hasFile('gym.logo')) {
            $logoPath = $request->file('gym.logo')->store('logos', 'local');
        }

        $settings = $action->handle($validated, $request->user(), $logoPath);

        return (new SettingResource($settings))
            ->withMessage('Settings updated successfully')
            ->response();
    }

    public function whatsappTemplates(StoreSetting $settings): JsonResponse
    {
        return $this->success(
            data: ['templates' => $settings->read('whatsapp.templates') ?? []],
            message: 'WhatsApp templates retrieved successfully',
        );
    }
}
