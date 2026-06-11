<?php

use App\Models\User;
use App\Support\FoundationPermissions;
use App\Support\SystemPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\RoleMatrixSeeder;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(RoleMatrixSeeder::class);
});

test('lockout guard prevents deleting the last role holding roles.manage', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    // Admin role is a preset, which already cannot be deleted.
    // Let's create a custom role with roles.manage, assign it to a user, and delete Admin role's users.
    $customAdminRole = Role::create(['name' => 'Custom Admin', 'guard_name' => 'web']);
    $customAdminRole->givePermissionTo(SystemPermissions::PERM_ROLES_MANAGE);

    $user = User::factory()->create();
    $user->assignRole($customAdminRole);

    // Remove admin role from $admin so $user is the only one with roles.manage (via Custom Admin)
    $admin->removeRole(FoundationPermissions::ROLE_ADMIN);
    $admin->assignRole($customAdminRole);
    Sanctum::actingAs($admin);

    // Deleting the Custom Admin role should fail because it is the last role granting roles.manage to any user.
    $this->deleteJson("/api/v1/roles/{$customAdminRole->id}")
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed')
        ->assertJsonPath('error.message', 'Cannot delete the last role granting role management permissions.');
});

test('lockout guard prevents stripping roles.manage from the last role holding it', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    // Create a custom admin role, assign to user, remove Admin role from $admin, so Custom Admin is the only roles.manage role
    $customAdminRole = Role::create(['name' => 'Custom Admin', 'guard_name' => 'web']);
    $customAdminRole->givePermissionTo(SystemPermissions::PERM_ROLES_MANAGE);

    $user = User::factory()->create();
    $user->assignRole($customAdminRole);

    $admin->removeRole(FoundationPermissions::ROLE_ADMIN);
    $admin->assignRole($customAdminRole);
    Sanctum::actingAs($admin);

    // Updating Custom Admin role to remove roles.manage permission should fail
    $this->putJson("/api/v1/roles/{$customAdminRole->id}", [
        'name' => 'Custom Admin',
        'permissions' => ['members.view'], // stripping roles.manage
    ])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed')
        ->assertJsonPath('error.message', 'Cannot remove role management permission from the last role holding it.');
});

test('lockout guard prevents removing roles.manage role from the last user holding it', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    // $admin is the only user with Admin role (and therefore roles.manage).
    // Attempting to remove Admin role from $admin should fail.
    $this->postJson("/api/v1/users/{$admin->id}/roles", [
        'roles' => [FoundationPermissions::ROLE_CASHIER], // stripping Admin
    ])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed')
        ->assertJsonPath('error.message', 'Cannot remove role management permissions from the last user holding them.');
});
