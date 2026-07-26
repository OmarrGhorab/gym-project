<?php

use App\Support\FoundationPermissions;
use App\Support\MembershipPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\MembershipAccessSeeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

/**
 * Phase 1 Foundational — MembershipAccessSeeder
 *
 * Verifies that MembershipAccessSeeder creates all expected permissions and
 * assigns them correctly to each role, matching the role matrix in the seeder.
 */

// -----------------------------------------------------------------
// Permission creation
// -----------------------------------------------------------------

test('seeder creates all membership permissions', function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(MembershipAccessSeeder::class);

    foreach (MembershipPermissions::ALL_PERMISSIONS as $permissionName) {
        expect(Permission::where('name', $permissionName)->exists())->toBeTrue(
            "Permission '{$permissionName}' was not created by MembershipAccessSeeder",
        );
    }
});

// -----------------------------------------------------------------
// Idempotency
// -----------------------------------------------------------------

test('seeder is idempotent and does not create duplicate permissions on re-run', function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(MembershipAccessSeeder::class);
    $this->seed(MembershipAccessSeeder::class);

    $count = Permission::whereIn('name', MembershipPermissions::ALL_PERMISSIONS)->count();
    expect($count)->toBe(count(MembershipPermissions::ALL_PERMISSIONS));
});

// -----------------------------------------------------------------
// Admin — all membership permissions
// -----------------------------------------------------------------

test('admin role receives all membership permissions', function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(MembershipAccessSeeder::class);

    $admin = Role::findByName(FoundationPermissions::ROLE_ADMIN);

    foreach (MembershipPermissions::ALL_PERMISSIONS as $permissionName) {
        expect($admin->hasPermissionTo($permissionName))->toBeTrue(
            "Admin should have permission '{$permissionName}'",
        );
    }
});

// -----------------------------------------------------------------
// Manager — all except *.delete
// -----------------------------------------------------------------

test('manager role receives all membership permissions except delete', function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(MembershipAccessSeeder::class);

    $manager = Role::findByName(FoundationPermissions::ROLE_MANAGER);

    $deletePermissions = array_filter(
        MembershipPermissions::ALL_PERMISSIONS,
        static fn (string $p): bool => str_ends_with($p, '.delete'),
    );

    $nonDeletePermissions = array_filter(
        MembershipPermissions::ALL_PERMISSIONS,
        static fn (string $p): bool => ! str_ends_with($p, '.delete'),
    );

    foreach ($nonDeletePermissions as $permissionName) {
        expect($manager->hasPermissionTo($permissionName))->toBeTrue(
            "Manager should have permission '{$permissionName}'",
        );
    }

    foreach ($deletePermissions as $permissionName) {
        expect($manager->hasPermissionTo($permissionName))->toBeFalse(
            "Manager should NOT have delete permission '{$permissionName}'",
        );
    }
});

// -----------------------------------------------------------------
// Cashier — sell-focused permissions only
// -----------------------------------------------------------------

test('cashier role has correct membership permissions', function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(MembershipAccessSeeder::class);

    $cashier = Role::findByName(FoundationPermissions::ROLE_CASHIER);

    $expected = [
        MembershipPermissions::PERM_MEMBERS_VIEW,
        MembershipPermissions::PERM_MEMBERS_CREATE,
        MembershipPermissions::PERM_MEMBERS_UPDATE,
        MembershipPermissions::PERM_SUBSCRIPTIONS_VIEW,
        MembershipPermissions::PERM_SUBSCRIPTIONS_CREATE,
        MembershipPermissions::PERM_SUBSCRIPTIONS_RENEW,
        MembershipPermissions::PERM_SUBSCRIPTIONS_UPGRADE,
        MembershipPermissions::PERM_PAYMENTS_VIEW,
        MembershipPermissions::PERM_PAYMENTS_CREATE,
        // The front-desk shell route "/dashboard" is itself gated on dashboard.view
        // (frontend/src/lib/authorization.tsx), so a cashier cannot log in without it.
        // RoleMatrixSeeder — the authoritative preset matrix — grants it too.
        MembershipPermissions::PERM_DASHBOARD_VIEW,
    ];

    $notExpected = array_values(array_diff(MembershipPermissions::ALL_PERMISSIONS, $expected));

    foreach ($expected as $permissionName) {
        expect($cashier->hasPermissionTo($permissionName))->toBeTrue(
            "Cashier should have permission '{$permissionName}'",
        );
    }

    foreach ($notExpected as $permissionName) {
        expect($cashier->hasPermissionTo($permissionName))->toBeFalse(
            "Cashier should NOT have permission '{$permissionName}'",
        );
    }
});

// -----------------------------------------------------------------
// Accountant — read-only reporting permissions
// -----------------------------------------------------------------

test('accountant role has correct membership permissions', function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(MembershipAccessSeeder::class);

    $accountant = Role::findByName(FoundationPermissions::ROLE_ACCOUNTANT);

    $expected = [
        MembershipPermissions::PERM_MEMBERS_VIEW,
        MembershipPermissions::PERM_SUBSCRIPTIONS_VIEW,
        MembershipPermissions::PERM_PAYMENTS_VIEW,
        MembershipPermissions::PERM_DASHBOARD_VIEW,
    ];

    $notExpected = array_values(array_diff(MembershipPermissions::ALL_PERMISSIONS, $expected));

    foreach ($expected as $permissionName) {
        expect($accountant->hasPermissionTo($permissionName))->toBeTrue(
            "Accountant should have permission '{$permissionName}'",
        );
    }

    foreach ($notExpected as $permissionName) {
        expect($accountant->hasPermissionTo($permissionName))->toBeFalse(
            "Accountant should NOT have permission '{$permissionName}'",
        );
    }
});

// -----------------------------------------------------------------
// Captain — subscriptions.view only
// -----------------------------------------------------------------

test('captain role has only subscriptions view permission', function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(MembershipAccessSeeder::class);

    $captain = Role::findByName(FoundationPermissions::ROLE_CAPTAIN);

    expect($captain->hasPermissionTo(MembershipPermissions::PERM_SUBSCRIPTIONS_VIEW))->toBeTrue();

    $notExpected = array_values(array_filter(
        MembershipPermissions::ALL_PERMISSIONS,
        static fn (string $p): bool => $p !== MembershipPermissions::PERM_SUBSCRIPTIONS_VIEW,
    ));

    foreach ($notExpected as $permissionName) {
        expect($captain->hasPermissionTo($permissionName))->toBeFalse(
            "Captain should NOT have permission '{$permissionName}'",
        );
    }
});
