<?php

namespace App\Actions\Settings;

use App\Models\Setting;
use App\Models\User;
use Illuminate\Support\Facades\Cache;

final class UpdateSettings
{
    public function __construct(private readonly StoreSetting $store) {}

    /**
     * Persist all provided flat settings keys and log the change.
     *
     * @param  array<string, mixed>  $flatSettings  Dot-notation key → value map
     *                                              (file paths already resolved by caller).
     * @return array<string, mixed>  Fresh key → value snapshot after update.
     */
    public function handle(array $flatSettings, User $user): array
    {
        foreach ($flatSettings as $key => $value) {
            $this->store->execute($key, $value);
        }

        Cache::forget('settings.all');

        activity()
            ->causedBy($user)
            ->log('Updated system settings');

        return Cache::rememberForever('settings.all', fn () =>
            Setting::all()->pluck('value', 'key')->toArray());
    }
}
