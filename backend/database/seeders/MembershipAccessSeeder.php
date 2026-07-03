<?php

namespace Database\Seeders;

use App\Support\FoundationPermissions;
use App\Support\MembershipPermissions;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

/**
 * Seeds the Phase 1 membership-module permissions and assigns them to roles.
 *
 * Role matrix:
 *   Admin      — all membership permissions
 *   Manager    — all membership permissions except *.delete
 *   Cashier    — members.view/create/update, subscriptions.view/create/renew,
 *                payments.view/create
 *   Accountant — payments.view, members.view, subscriptions.view, dashboard.view
 *   Captain    — subscriptions.view
 *
 * Idempotent — uses firstOrCreate so re-running does not create duplicates.
 * Roles themselves are created by FoundationAccessSeeder (which must run first).
 */
class MembershipAccessSeeder extends Seeder
{
    public function run(): void
    {
        // Spatie caches permission lookups; clear before seeding to avoid
        // stale-cache issues in development and test environments.
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        // Create all Phase 1 membership permissions.
        foreach (MembershipPermissions::ALL_PERMISSIONS as $permissionName) {
            Permission::firstOrCreate(
                ['name' => $permissionName, 'guard_name' => 'web'],
            );
        }

        // Retrieve the existing roles (created by FoundationAccessSeeder).
        $admin = Role::firstOrCreate(['name' => FoundationPermissions::ROLE_ADMIN, 'guard_name' => 'web']);
        $manager = Role::firstOrCreate(['name' => FoundationPermissions::ROLE_MANAGER, 'guard_name' => 'web']);
        $cashier = Role::firstOrCreate(['name' => FoundationPermissions::ROLE_CASHIER, 'guard_name' => 'web']);
        $accountant = Role::firstOrCreate(['name' => FoundationPermissions::ROLE_ACCOUNTANT, 'guard_name' => 'web']);
        $captain = Role::firstOrCreate(['name' => FoundationPermissions::ROLE_CAPTAIN, 'guard_name' => 'web']);

        // Admin — full access to all membership permissions.
        $admin->givePermissionTo(MembershipPermissions::ALL_PERMISSIONS);

        // Manager — all membership permissions except *.delete (no destructive ops).
        $managerPermissions = array_values(array_filter(
            MembershipPermissions::ALL_PERMISSIONS,
            static fn (string $p): bool => ! str_ends_with($p, '.delete'),
        ));
        $manager->givePermissionTo($managerPermissions);

        // Cashier — sell subscriptions and receive payments; cannot manage plans
        // or access reporting/dashboard.
        $cashier->givePermissionTo([
            MembershipPermissions::PERM_MEMBERS_VIEW,
            MembershipPermissions::PERM_MEMBERS_CREATE,
            MembershipPermissions::PERM_MEMBERS_UPDATE,
            MembershipPermissions::PERM_SUBSCRIPTIONS_VIEW,
            MembershipPermissions::PERM_SUBSCRIPTIONS_CREATE,
            MembershipPermissions::PERM_SUBSCRIPTIONS_RENEW,
            MembershipPermissions::PERM_SUBSCRIPTIONS_UPGRADE,
            MembershipPermissions::PERM_PAYMENTS_VIEW,
            MembershipPermissions::PERM_PAYMENTS_CREATE,
        ]);

        // Accountant — read-only reporting: dues, revenue, member/subscription
        // overview, and dashboard summary.
        $accountant->givePermissionTo([
            MembershipPermissions::PERM_MEMBERS_VIEW,
            MembershipPermissions::PERM_SUBSCRIPTIONS_VIEW,
            MembershipPermissions::PERM_PAYMENTS_VIEW,
            MembershipPermissions::PERM_DASHBOARD_VIEW,
        ]);

        // Captain — view subscriptions only (e.g. to confirm membership at entry).
        $captain->givePermissionTo([
            MembershipPermissions::PERM_SUBSCRIPTIONS_VIEW,
        ]);
    }
}
