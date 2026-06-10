<?php

namespace App\Actions\Settings;

use App\Models\Setting;

/**
 * Stores or updates a foundation setting and reads it back.
 *
 * This action is transport-agnostic: it accepts typed inputs (not an HTTP
 * request) so it can be called from controllers, commands, jobs, and tests
 * identically (Constitution §II).
 *
 * Upsert semantics: calling execute() with the same key overwrites the previous
 * value. The unique index on `key` guarantees no duplicates at the DB level.
 */
class StoreSetting
{
    /**
     * Persist a setting value under the given key.
     *
     * @param  string  $key  Dot-notation setting key, e.g. "gym.name".
     * @param  mixed  $value  Scalar, array, or object — cast to JSON by the model.
     */
    public function execute(string $key, mixed $value): Setting
    {
        /** @var Setting $setting */
        $setting = Setting::updateOrCreate(
            ['key' => $key],
            ['value' => $value],
        );

        return $setting;
    }

    /**
     * Read a setting value by key.
     *
     * Returns null when the key does not exist, matching a deliberate
     * "not configured" state rather than throwing.
     */
    public function read(string $key): mixed
    {
        $setting = Setting::where('key', $key)->first();

        return $setting?->value;
    }
}
