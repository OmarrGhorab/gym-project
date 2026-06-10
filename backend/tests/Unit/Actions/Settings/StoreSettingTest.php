<?php

use App\Actions\Settings\StoreSetting;
use App\Models\Setting;
use Illuminate\Foundation\Testing\RefreshDatabase;

// Unit tests: no HTTP layer, but do use the database (via Pest.php -> uses(RefreshDatabase)->in('Feature','Unit'))
// Note: Pest.php applies RefreshDatabase to all tests in Feature dir only.
// Unit tests here touch the database (Eloquent); we add RefreshDatabase at the describe level.

uses(RefreshDatabase::class);

describe('StoreSetting action', function () {
    it('stores a new setting and returns the model', function () {
        $action = new StoreSetting;

        $setting = $action->execute('gym.name', 'Power Gym');

        expect($setting)->toBeInstanceOf(Setting::class)
            ->and($setting->key)->toBe('gym.name')
            ->and($setting->value)->toBe('Power Gym');

        $this->assertDatabaseHas('settings', [
            'key' => 'gym.name',
        ]);
    });

    it('reads back the stored value accurately', function () {
        $action = new StoreSetting;
        $action->execute('gym.name', 'Power Gym');

        $found = $action->read('gym.name');

        expect($found)->toBe('Power Gym');
    });

    it('updates an existing setting when the same key is stored again', function () {
        $action = new StoreSetting;
        $action->execute('gym.name', 'Old Name');
        $action->execute('gym.name', 'New Name');

        $found = $action->read('gym.name');

        expect($found)->toBe('New Name');
        $this->assertDatabaseCount('settings', 1);
    });

    it('returns null when reading a key that does not exist', function () {
        $action = new StoreSetting;

        $found = $action->read('non.existent.key');

        expect($found)->toBeNull();
    });

    it('stores and retrieves an array value via JSON cast', function () {
        $action = new StoreSetting;
        $payload = ['currency' => 'EGP', 'timezone' => 'Africa/Cairo'];
        $action->execute('gym.locale', $payload);

        $found = $action->read('gym.locale');

        expect($found)->toBe($payload);
    });
});
