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

test('admin can read settings', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    $response = $this->getJson('/api/v1/settings')
        ->assertStatus(200)
        ->assertJsonStructure([
            'data' => [
                'gym' => [
                    'name',
                    'colors' => ['primary', 'secondary'],
                    'logo',
                ],
                'reminder_days',
                'currency',
                'vat_rate',
                'receipt_template',
            ],
        ]);
});

test('admin can update settings', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    $payload = [
        'gym' => [
            'name' => 'Super Power Gym',
            'colors' => [
                'primary' => '#ff0000',
                'secondary' => '#00ff00',
            ],
            'logo' => 'logos/my-gym.png',
        ],
        'reminder_days' => 10,
        'currency' => 'EUR',
        'vat_rate' => 18.5,
        'receipt_template' => 'premium_style',
        'attendance' => [
            'gym_latitude' => 30.0444,
            'gym_longitude' => 31.2357,
            'gym_radius_meters' => 120,
            'default_grace_minutes' => 20,
        ],
    ];

    $this->putJson('/api/v1/settings', $payload)
        ->assertStatus(200)
        ->assertJsonPath('data.gym.name', 'Super Power Gym')
        ->assertJsonPath('data.gym.colors.primary', '#ff0000')
        ->assertJsonPath('data.vat_rate', 18.5)
        ->assertJsonPath('data.attendance.gym_latitude', 30.0444)
        ->assertJsonPath('data.attendance.gym_longitude', 31.2357)
        ->assertJsonPath('data.attendance.gym_radius_meters', 120)
        ->assertJsonPath('data.attendance.default_grace_minutes', 20);

    // Read back and check
    $this->getJson('/api/v1/settings')
        ->assertStatus(200)
        ->assertJsonPath('data.gym.name', 'Super Power Gym')
        ->assertJsonPath('data.reminder_days', 10)
        ->assertJsonPath('data.currency', 'EUR')
        ->assertJsonPath('data.vat_rate', 18.5)
        ->assertJsonPath('data.receipt_template', 'premium_style')
        ->assertJsonPath('data.attendance.gym_radius_meters', 120);
});

test('non-admin cannot read or update settings', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_CASHIER);
    Sanctum::actingAs($user);

    $this->getJson('/api/v1/settings')
        ->assertStatus(403);

    $this->putJson('/api/v1/settings', [
        'gym' => ['name' => 'Unauthorized Change'],
    ])->assertStatus(403);
});

test('updating settings logs an audit entry', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    $this->putJson('/api/v1/settings', [
        'gym' => ['name' => 'Audit Test Gym'],
    ])->assertStatus(200);

    $this->assertDatabaseHas('activity_log', [
        'causer_id' => $admin->id,
        'description' => 'Updated system settings',
    ]);
});
