<?php

use App\Models\EmployeeShift;
use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\RoleMatrixSeeder;
use Laravel\Sanctum\Sanctum;

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(RoleMatrixSeeder::class);
});

test('settings manager can create update list and deactivate employee shifts', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    $create = $this->postJson('/api/v1/attendance/shifts', [
        'name' => 'Morning 9-5',
        'starts_at' => '09:00',
        'ends_at' => '17:00',
        'grace_minutes' => 15,
        'is_active' => true,
    ])
        ->assertCreated()
        ->assertJsonPath('data.name', 'Morning 9-5')
        ->assertJsonPath('data.starts_at', '09:00')
        ->assertJsonPath('data.ends_at', '17:00');

    $shiftId = $create->json('data.id');

    $this->putJson("/api/v1/attendance/shifts/{$shiftId}", [
        'name' => 'Morning Shift',
        'starts_at' => '09:00',
        'ends_at' => '17:30',
        'grace_minutes' => 20,
        'is_active' => true,
    ])
        ->assertOk()
        ->assertJsonPath('data.name', 'Morning Shift')
        ->assertJsonPath('data.ends_at', '17:30')
        ->assertJsonPath('data.grace_minutes', 20);

    $this->getJson('/api/v1/attendance/shifts/manage')
        ->assertOk()
        ->assertJsonFragment(['name' => 'Morning Shift']);

    $this->deleteJson("/api/v1/attendance/shifts/{$shiftId}")
        ->assertOk()
        ->assertJsonPath('data.is_active', false);

    expect(EmployeeShift::find($shiftId))->not->toBeNull()
        ->and(EmployeeShift::find($shiftId)->is_active)->toBeFalse();
});

test('employee shift management validates times and authorization', function (): void {
    $manager = User::factory()->create();
    $manager->assignRole(FoundationPermissions::ROLE_MANAGER);
    Sanctum::actingAs($manager);

    $this->postJson('/api/v1/attendance/shifts', [
        'name' => 'M',
        'starts_at' => '9am',
        'ends_at' => '17:00',
        'grace_minutes' => 300,
    ])
        ->assertForbidden();

    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    $this->postJson('/api/v1/attendance/shifts', [
        'name' => 'M',
        'starts_at' => '9am',
        'ends_at' => '17:00',
        'grace_minutes' => 300,
    ])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed');
});
