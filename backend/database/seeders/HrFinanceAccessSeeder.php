<?php

namespace Database\Seeders;

use App\Support\FoundationPermissions;
use App\Support\HrFinancePermissions;
use App\Support\PosPermissions;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

/**
 * Seeds the Phase 3 HR & Finance module permissions and assigns them to roles.
 *
 * Role matrix:
 *   Admin      — all HR & Finance permissions
 *   Manager    — all HR & Finance permissions
 *   Accountant — reports.view, expenses.*, payroll.view, commissions.view
 *
 * Idempotent — uses firstOrCreate.
 * Roles themselves are created by FoundationAccessSeeder.
 */
class HrFinanceAccessSeeder extends Seeder
{
    public function run(): void
    {
        // Clear Spatie permission cache.
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        // Create all Phase 3 HR & Finance permissions.
        foreach (HrFinancePermissions::ALL_PERMISSIONS as $permissionName) {
            Permission::firstOrCreate(
                ['name' => $permissionName, 'guard_name' => 'web'],
            );
        }

        // Ensure reports.view exists.
        Permission::firstOrCreate(
            ['name' => PosPermissions::PERM_REPORTS_VIEW, 'guard_name' => 'web'],
        );

        // Retrieve existing roles or create them.
        $admin = Role::firstOrCreate(['name' => FoundationPermissions::ROLE_ADMIN, 'guard_name' => 'web']);
        $manager = Role::firstOrCreate(['name' => FoundationPermissions::ROLE_MANAGER, 'guard_name' => 'web']);
        $accountant = Role::firstOrCreate(['name' => FoundationPermissions::ROLE_ACCOUNTANT, 'guard_name' => 'web']);

        // Admin — all permissions.
        $admin->givePermissionTo(HrFinancePermissions::ALL_PERMISSIONS);

        // Manager — all permissions.
        $manager->givePermissionTo(HrFinancePermissions::ALL_PERMISSIONS);

        // Accountant — reports.view (reused), expenses.*, payroll.view, commissions.view.
        $accountant->givePermissionTo([
            PosPermissions::PERM_REPORTS_VIEW,
            HrFinancePermissions::PERM_EXPENSES_VIEW,
            HrFinancePermissions::PERM_EXPENSES_CREATE,
            HrFinancePermissions::PERM_EXPENSES_UPDATE,
            HrFinancePermissions::PERM_EXPENSES_DELETE,
            HrFinancePermissions::PERM_PAYROLL_VIEW,
            HrFinancePermissions::PERM_COMMISSIONS_VIEW,
        ]);
    }
}
