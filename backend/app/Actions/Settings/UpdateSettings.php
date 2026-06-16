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
     * @return array<string, mixed> Fresh key → value snapshot after update.
     */
    public function handle(array $flatSettings, User $user): array
    {
        foreach ($flatSettings as $key => $value) {
            $this->store->execute($key, $value);
        }

        // Read fresh values from DB, then atomically overwrite the cache.
        // Using forget + rememberForever creates a race window; put() with the
        // already-fetched snapshot is safe because the last writer wins and the
        // value is always consistent with the DB state at time of write.
        $fresh = Setting::all()->pluck('value', 'key')->toArray();
        Cache::forever('settings.all', $fresh);

        activity()
            ->causedBy($user)
            ->log('Updated system settings');

        return $fresh;
    }
}
