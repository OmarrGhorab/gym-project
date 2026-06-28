<?php

use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\RoleMatrixSeeder;
use Laravel\Sanctum\Sanctum;

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(RoleMatrixSeeder::class);
});

test('it validates setting constraints', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    // Test negative reminder days
    $this->putJson('/api/v1/settings', [
        'reminder_days' => -5,
    ])->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed');

    // Test VAT rate out of range (greater than 100)
    $this->putJson('/api/v1/settings', [
        'vat_rate' => 105,
    ])->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed');

    // Test VAT rate negative
    $this->putJson('/api/v1/settings', [
        'vat_rate' => -1,
    ])->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed');

    // Test invalid brand colors format
    $this->putJson('/api/v1/settings', [
        'gym' => [
            'colors' => [
                'primary' => 'invalid-color',
                'secondary' => '#ZZZZZZ',
            ],
        ],
    ])->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed');

    $this->putJson('/api/v1/settings', [
        'attendance' => [
            'gym_latitude' => 120,
            'gym_longitude' => 220,
            'gym_radius_meters' => 5,
            'default_grace_minutes' => 300,
        ],
    ])->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed');
});
