<?php

namespace App\Http\Controllers\Api\V1;

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
        $settings = Cache::rememberForever('settings.all', fn () =>
            Setting::all()->pluck('value', 'key')->toArray());

        return (new SettingResource($settings))
            ->withMessage('Settings retrieved successfully')
            ->response();
    }

    public function update(UpdateSettingsRequest $request, UpdateSettings $action): JsonResponse
    {
        $validated = $request->validated();

        $flatSettings = [];

        if (isset($validated['gym'])) {
            if (array_key_exists('name', $validated['gym'])) {
                $flatSettings['gym.name'] = $validated['gym']['name'];
            }
            if (array_key_exists('colors', $validated['gym'])) {
                $flatSettings['gym.colors'] = $validated['gym']['colors'];
            }
            if ($request->hasFile('gym.logo')) {
                $path = $request->file('gym.logo')->store('logos', 'public');
                $flatSettings['gym.logo'] = $path;
            } elseif (array_key_exists('logo', $validated['gym'])) {
                $flatSettings['gym.logo'] = $validated['gym']['logo'];
            }
        }

        if (array_key_exists('reminder_days', $validated)) {
            $flatSettings['reminder_days'] = $validated['reminder_days'];
        }
        if (array_key_exists('currency', $validated)) {
            $flatSettings['currency'] = $validated['currency'];
        }
        if (array_key_exists('vat_rate', $validated)) {
            $flatSettings['vat_rate'] = $validated['vat_rate'];
        }
        if (array_key_exists('receipt_template', $validated)) {
            $flatSettings['receipt_template'] = $validated['receipt_template'];
        }

        $settings = $action->handle($flatSettings, $request->user());

        return (new SettingResource($settings))
            ->withMessage('Settings updated successfully')
            ->response();
    }
}
