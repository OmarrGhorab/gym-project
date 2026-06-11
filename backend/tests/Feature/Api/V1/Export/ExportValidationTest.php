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

test('invalid resource returns 422', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    $this->getJson('/api/v1/export/invalid_resource?format=xlsx')
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed');
});

test('invalid format returns 422', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    $this->getJson('/api/v1/export/members?format=invalid_format')
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed');
});

test('export logs an audit entry', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    $this->getJson('/api/v1/export/members?format=xlsx')
        ->assertStatus(200);

    $this->assertDatabaseHas('activity_log', [
        'causer_id' => $admin->id,
        'description' => 'Exported members in xlsx format',
    ]);
});
