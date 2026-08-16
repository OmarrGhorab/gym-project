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
        ],
    ];

    $this->putJson('/api/v1/settings', $payload)
        ->assertStatus(200)
        ->assertJsonPath('data.gym.name', 'Super Power Gym')
        ->assertJsonPath('data.gym.colors.primary', '#ff0000')
        ->assertJsonPath('data.vat_rate', 18.5)
        ->assertJsonPath('data.attendance.gym_latitude', 30.0444)
        ->assertJsonPath('data.attendance.gym_longitude', 31.2357)
        ->assertJsonPath('data.attendance.gym_radius_meters', 120);

    // Read back and check
    $this->getJson('/api/v1/settings')
        ->assertStatus(200)
        ->assertJsonPath('data.gym.name', 'Super Power Gym')
        ->assertJsonPath('data.reminder_days', [10])
        ->assertJsonPath('data.currency', 'EUR')
        ->assertJsonPath('data.vat_rate', 18.5)
        ->assertJsonPath('data.receipt_template', 'premium_style')
        ->assertJsonPath('data.attendance.gym_radius_meters', 120);
});

test('admin can save and retrieve whatsapp message templates', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    $templates = [
        'expiry_reminder' => 'Hello {{member_name}}, your plan ends {{end_date}}.',
        'renewal_confirmation' => 'Renewed {{plan_name}}.',
    ];

    $this->putJson('/api/v1/settings', ['whatsapp' => ['templates' => $templates]])
        ->assertOk()
        ->assertJsonPath('data.whatsapp.templates.expiry_reminder', $templates['expiry_reminder']);

    $this->getJson('/api/v1/settings/whatsapp-templates')
        ->assertOk()
        ->assertJsonPath('data.templates.renewal_confirmation', $templates['renewal_confirmation']);
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

test('shift automation defaults to manual and the handover toggle round-trips', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    // Nothing stored: the desk must describe itself as hand-driven, or staff are
    // blocked from opening a shift by a workflow nobody asked for.
    $this->getJson('/api/v1/settings')
        ->assertOk()
        ->assertJsonPath('data.shifts.require_handover_to_open', false);

    $this->putJson('/api/v1/settings', [
        'shifts' => [
            'require_handover_to_open' => true,
        ],
    ])->assertOk();

    // The gym can switch the control back on — this is a default, not a removal.
    $this->getJson('/api/v1/settings')
        ->assertOk()
        ->assertJsonPath('data.shifts.require_handover_to_open', true);

    expect(App\Models\Setting::query()->where('key', 'shifts.require_handover_to_open')->exists())->toBeTrue();
});

/**
 * The hour the drawer goes back to zero. A gym that trades past 05:00 has to be
 * able to move it, or its night shift is filed under the wrong day.
 */
test('the working day boundary defaults to 5am and round-trips', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    $this->getJson('/api/v1/settings')
        ->assertOk()
        ->assertJsonPath('data.shifts.day_starts_at_hour', 5);

    $this->putJson('/api/v1/settings', ['shifts' => ['day_starts_at_hour' => 7]])->assertOk();

    $this->getJson('/api/v1/settings')
        ->assertOk()
        ->assertJsonPath('data.shifts.day_starts_at_hour', 7);
});

/**
 * The reset the gym recognises: shut for this long since the last shift closed,
 * and the next one starts empty. Adjustable because a gym with a long midday
 * break is not the same as one that trades straight through.
 */
test('the closure that ends the day defaults to 4 hours and round-trips', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    $this->getJson('/api/v1/settings')
        ->assertOk()
        ->assertJsonPath('data.shifts.reset_after_closed_hours', 4);

    $this->putJson('/api/v1/settings', ['shifts' => ['reset_after_closed_hours' => 6]])->assertOk();

    $this->getJson('/api/v1/settings')
        ->assertOk()
        ->assertJsonPath('data.shifts.reset_after_closed_hours', 6);
});

test('the closure threshold rejects a value that could never fire', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    $this->putJson('/api/v1/settings', ['shifts' => ['reset_after_closed_hours' => 0]])->assertStatus(422);
    $this->putJson('/api/v1/settings', ['shifts' => ['reset_after_closed_hours' => 25]])->assertStatus(422);
});

test('the working day boundary rejects an hour outside the clock', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    $this->putJson('/api/v1/settings', ['shifts' => ['day_starts_at_hour' => 24]])
        ->assertStatus(422);
});
