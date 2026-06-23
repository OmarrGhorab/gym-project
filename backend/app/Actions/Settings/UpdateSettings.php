<?php

namespace App\Actions\Settings;

use App\Models\Setting;
use App\Models\User;
use Illuminate\Support\Facades\Cache;

final class UpdateSettings
{
    public function __construct(private readonly StoreSetting $store) {}

    /**
     * Persist all provided settings and log the change.
     *
     * Accepts validated input with nested keys and an optional pre-resolved
     * logo path from the controller layer. Flattening of nested keys into
     * dot-notation is handled here so controllers stay thin.
     *
     * @param  array<string, mixed>  $validated  Raw validated request data.
     * @return array<string, mixed> Fresh key → value snapshot after update.
     */
    public function handle(array $validated, User $user, ?string $logoPath = null): array
    {
        $flatSettings = $this->flatten($validated, $logoPath);

        foreach ($flatSettings as $key => $value) {
            $this->store->execute($key, $value);
        }

        $fresh = Setting::all()->pluck('value', 'key')->toArray();
        Cache::forever('settings.all', $fresh);

        activity()
            ->causedBy($user)
            ->log('Updated system settings');

        return $fresh;
    }

    /**
     * @param  array<string, mixed>  $validated
     * @return array<string, string>
     */
    private function flatten(array $validated, ?string $logoPath): array
    {
        $flat = [];

        if (isset($validated['gym'])) {
            if (array_key_exists('name', $validated['gym'])) {
                $flat['gym.name'] = $validated['gym']['name'];
            }
            if (array_key_exists('colors', $validated['gym'])) {
                $flat['gym.colors'] = $validated['gym']['colors'];
            }
            if ($logoPath !== null) {
                $flat['gym.logo'] = $logoPath;
            } elseif (array_key_exists('logo', $validated['gym'])) {
                $flat['gym.logo'] = $validated['gym']['logo'];
            }
        }

        foreach (['reminder_days', 'currency', 'vat_rate', 'receipt_template'] as $key) {
            if (array_key_exists($key, $validated)) {
                $flat[$key] = $validated[$key];
            }
        }

        return $flat;
    }
}
