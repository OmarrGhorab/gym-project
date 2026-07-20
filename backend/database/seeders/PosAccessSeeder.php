<?php

namespace Database\Seeders;

use App\Support\FoundationPermissions;
use App\Support\PosPermissions;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

/**
 * Seeds the Phase 2 POS, products, and inventory module permissions and assigns them to roles.
 *
 * Role matrix:
 *   Admin      — all POS permissions
 *   Manager    — all POS permissions
 *   Cashier    — products.view, sales.view, sales.create, reports.view (Finance / shift desk)
 *   Accountant — sales.view, reports.view
 *
 * Idempotent — uses firstOrCreate so re-running does not create duplicates.
 * Roles themselves are created by FoundationAccessSeeder.
 */
class PosAccessSeeder extends Seeder
{
    public function run(): void
    {
        // Clear Spatie permission cache.
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        // Create all Phase 2 POS permissions.
        foreach (PosPermissions::ALL_PERMISSIONS as $permissionName) {
            Permission::firstOrCreate(
                ['name' => $permissionName, 'guard_name' => 'web'],
            );
        }

        // Retrieve existing roles.
        $admin = Role::firstOrCreate(['name' => FoundationPermissions::ROLE_ADMIN, 'guard_name' => 'web']);
        $manager = Role::firstOrCreate(['name' => FoundationPermissions::ROLE_MANAGER, 'guard_name' => 'web']);
        $cashier = Role::firstOrCreate(['name' => FoundationPermissions::ROLE_CASHIER, 'guard_name' => 'web']);
        $accountant = Role::firstOrCreate(['name' => FoundationPermissions::ROLE_ACCOUNTANT, 'guard_name' => 'web']);

        // Admin — all permissions.
        $admin->givePermissionTo(PosPermissions::ALL_PERMISSIONS);

        // Manager — all permissions.
        $manager->givePermissionTo(PosPermissions::ALL_PERMISSIONS);

        // Cashier — POS + reports.view so they can open Finance shift desk.
        $cashier->givePermissionTo([
            PosPermissions::PERM_PRODUCTS_VIEW,
            PosPermissions::PERM_SALES_VIEW,
            PosPermissions::PERM_SALES_CREATE,
            PosPermissions::PERM_REPORTS_VIEW,
        ]);

        // Accountant — sales.view, reports.view.
        $accountant->givePermissionTo([
            PosPermissions::PERM_SALES_VIEW,
            PosPermissions::PERM_REPORTS_VIEW,
        ]);
    }
}
