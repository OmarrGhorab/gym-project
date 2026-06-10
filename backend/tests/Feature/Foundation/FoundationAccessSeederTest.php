<?php

use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

/**
 * US3 — Enforce Role-Based Access: Foundation seeder
 *
 * Verifies that FoundationAccessSeeder creates the expected roles,
 * permissions, and role-permission assignments.
 */
test('seeder creates all foundation roles', function (): void {
    $this->seed(FoundationAccessSeeder::class);

    foreach (FoundationPermissions::ALL_ROLES as $roleName) {
        expect(Role::where('name', $roleName)->exists())->toBeTrue(
            "Role '{$roleName}' was not created by FoundationAccessSeeder",
        );
    }
});

test('seeder creates foundation access sample permission', function (): void {
    $this->seed(FoundationAccessSeeder::class);

    expect(
        Permission::where('name', FoundationPermissions::PERM_ACCESS_SAMPLE)->exists(),
    )->toBeTrue();
});

test('seeder assigns access sample permission to admin role', function (): void {
    $this->seed(FoundationAccessSeeder::class);

    $admin = Role::findByName(FoundationPermissions::ROLE_ADMIN);

    expect(
        $admin->hasPermissionTo(FoundationPermissions::PERM_ACCESS_SAMPLE),
    )->toBeTrue();
});

test('seeder is idempotent and does not create duplicate roles on re-run', function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(FoundationAccessSeeder::class);

    $roleCount = Role::whereIn('name', FoundationPermissions::ALL_ROLES)->count();
    expect($roleCount)->toBe(count(FoundationPermissions::ALL_ROLES));
});

test('non-admin roles do not have access sample permission by default', function (): void {
    $this->seed(FoundationAccessSeeder::class);

    $nonAdminRoles = [
        FoundationPermissions::ROLE_MANAGER,
        FoundationPermissions::ROLE_CASHIER,
        FoundationPermissions::ROLE_CAPTAIN,
        FoundationPermissions::ROLE_ACCOUNTANT,
    ];

    foreach ($nonAdminRoles as $roleName) {
        $role = Role::findByName($roleName);
        expect($role->hasPermissionTo(FoundationPermissions::PERM_ACCESS_SAMPLE))
            ->toBeFalse("Role '{$roleName}' should not have access-sample permission");
    }
});
