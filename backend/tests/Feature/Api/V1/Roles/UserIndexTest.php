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

test('admin can list users for role management', function (): void {
    $admin = User::factory()->create(['name' => 'Admin User']);
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    User::factory()->create(['name' => 'Desk User', 'email' => 'desk@example.com'])
        ->assignRole(FoundationPermissions::ROLE_CASHIER);
    Sanctum::actingAs($admin);

    $this->getJson('/api/v1/users?filter[search]=desk')
        ->assertOk()
        ->assertJsonPath('data.0.name', 'Desk User')
        ->assertJsonPath('data.0.roles.0', FoundationPermissions::ROLE_CASHIER);
});

test('users without role management cannot list users', function (): void {
    $captain = User::factory()->create();
    $captain->assignRole(FoundationPermissions::ROLE_CAPTAIN);
    Sanctum::actingAs($captain);

    $this->getJson('/api/v1/users')
        ->assertForbidden();
});
