<?php

use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\RoleMatrixSeeder;
use Illuminate\Testing\Fluent\AssertableJson;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(RoleMatrixSeeder::class);
});

test('admin can list all roles', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $this->getJson('/api/v1/roles')
        ->assertStatus(200)
        ->assertJson(fn (AssertableJson $json) => $json
            ->has('data')
            ->has('meta')
            ->has('message')
            ->has('data.0.id')
            ->has('data.0.name')
            ->has('data.0.is_preset')
            ->has('data.0.permissions')
            ->etc()
        );
});

test('admin can create a custom role with permissions', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $this->postJson('/api/v1/roles', [
        'name' => 'Custom Coach',
        'permissions' => ['members.view', 'subscriptions.view'],
    ])
        ->assertStatus(201)
        ->assertJson(fn (AssertableJson $json) => $json
            ->where('data.name', 'Custom Coach')
            ->where('data.is_preset', false)
            ->where('data.permissions.0', 'members.view')
            ->where('data.permissions.1', 'subscriptions.view')
            ->has('message')
            ->has('meta')
        );

    $this->assertDatabaseHas('roles', ['name' => 'Custom Coach']);
});

test('role creation validation rejects duplicate names', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $this->postJson('/api/v1/roles', [
        'name' => FoundationPermissions::ROLE_ADMIN,
        'permissions' => [],
    ])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed');
});

test('role creation validation rejects invalid permissions', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $this->postJson('/api/v1/roles', [
        'name' => 'Unique Name',
        'permissions' => ['invalid.permission.name'],
    ])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed');
});

test('admin can view role details', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $role = Role::findByName(FoundationPermissions::ROLE_CASHIER, 'web');

    $this->getJson("/api/v1/roles/{$role->id}")
        ->assertStatus(200)
        ->assertJsonPath('data.name', FoundationPermissions::ROLE_CASHIER)
        ->assertJsonPath('data.is_preset', true);
});

test('admin can update a custom role', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $role = Role::create(['name' => 'Custom Role', 'guard_name' => 'web']);

    $this->putJson("/api/v1/roles/{$role->id}", [
        'name' => 'Updated Custom Role',
        'permissions' => ['members.view'],
    ])
        ->assertStatus(200)
        ->assertJsonPath('data.name', 'Updated Custom Role')
        ->assertJsonPath('data.permissions.0', 'members.view');
});

test('admin cannot update a preset role', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $role = Role::findByName(FoundationPermissions::ROLE_CASHIER, 'web');

    $this->putJson("/api/v1/roles/{$role->id}", [
        'name' => 'Attempted Preset Rename',
        'permissions' => ['members.view'],
    ])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed');
});

test('admin can delete a custom role', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $role = Role::create(['name' => 'Temp Role', 'guard_name' => 'web']);

    $this->deleteJson("/api/v1/roles/{$role->id}")
        ->assertStatus(204);

    $this->assertDatabaseMissing('roles', ['name' => 'Temp Role']);
});

test('admin cannot delete a preset role', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $role = Role::findByName(FoundationPermissions::ROLE_CASHIER, 'web');

    $this->deleteJson("/api/v1/roles/{$role->id}")
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed');
});
