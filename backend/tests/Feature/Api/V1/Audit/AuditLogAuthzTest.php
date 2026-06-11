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

test('non-admin user without audit.view cannot view audit logs', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_CASHIER);
    Sanctum::actingAs($user);

    $this->getJson('/api/v1/audit-logs')
        ->assertStatus(403)
        ->assertJsonPath('error.code', 'forbidden');
});

test('unauthenticated request receives 401', function (): void {
    $this->getJson('/api/v1/audit-logs')
        ->assertStatus(401)
        ->assertJsonPath('error.code', 'unauthenticated');
});

test('it validates from date is before or equal to to date', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    $this->getJson('/api/v1/audit-logs?filter[from]=2026-06-11&filter[to]=2026-06-10')
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed')
        ->assertJsonStructure(['error' => ['code', 'message', 'details' => ['filter.to']]]);
});

test('it validates subject alias is known', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    $this->getJson('/api/v1/audit-logs?filter[subject]=invalid_alias')
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed')
        ->assertJsonStructure(['error' => ['code', 'message', 'details' => ['filter.subject']]]);
});
