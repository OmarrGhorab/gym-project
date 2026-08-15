<?php

namespace Database\Seeders;

use App\Support\FoundationPermissions;
use App\Support\PermissionMatrix;
use App\Support\SystemPermissions;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

/**
 * Seeds and finalizes the role-permission preset matrix.
 * Run last in DatabaseSeeder to overlay preset composition over all registered permissions.
 */
class RoleMatrixSeeder extends Seeder
{
    public function run(): void
    {
        // Forget cached permissions to avoid stale-cache issues
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        // 1. Ensure all system permissions are registered in the DB
        foreach (PermissionMatrix::all() as $permissionName) {
            Permission::firstOrCreate([
                'name' => $permissionName,
                'guard_name' => 'web',
            ]);
        }

        // 2. Fetch or create all five foundation roles
        $adminRole = Role::firstOrCreate(['name' => FoundationPermissions::ROLE_ADMIN, 'guard_name' => 'web']);
        $managerRole = Role::firstOrCreate(['name' => FoundationPermissions::ROLE_MANAGER, 'guard_name' => 'web']);
        $cashierRole = Role::firstOrCreate(['name' => FoundationPermissions::ROLE_CASHIER, 'guard_name' => 'web']);
        $captainRole = Role::firstOrCreate(['name' => FoundationPermissions::ROLE_CAPTAIN, 'guard_name' => 'web']);
        $accountantRole = Role::firstOrCreate(['name' => FoundationPermissions::ROLE_ACCOUNTANT, 'guard_name' => 'web']);

        // 3. Define the detailed permission mapping for each role
        // Admin gets everything
        $adminRole->syncPermissions(PermissionMatrix::all());

        // Manager permissions
        $managerPermissions = [
            'members.view', 'members.create', 'members.update', 'members.delete',
            'plans.view', 'plans.create', 'plans.update', 'plans.delete',
            'subscriptions.view', 'subscriptions.create', 'subscriptions.renew', 'subscriptions.upgrade', 'subscriptions.freeze', 'subscriptions.freeze_approve', 'subscriptions.stop', 'subscriptions.force_refund',
            'payments.view', 'payments.create',
            'products.view', 'products.create', 'products.update', 'products.delete',
            'sales.view', 'sales.create', 'sales.void',
            'inventory.adjust',
            'reports.view',
            'employees.view', 'employees.create', 'employees.update', 'employees.delete',
            'commissions.view', 'commissions.backfill', 'commissions.earn_sales',
            'payroll.view', 'payroll.generate', 'payroll.pay',
            'expenses.view', 'expenses.create', 'expenses.update', 'expenses.delete',
            // No attendance.update/delete: correcting a day by hand is Admin-only.
            'attendance.view', 'attendance.create',
            'dashboard.view',
            'notifications.view',
            'audit.view',
        ];

        // Cashier — front desk: sell memberships/POS + run Finance shift desk (open/close/handover).
        $cashierPermissions = [
            'members.view', 'members.create', 'members.update',
            'plans.view',
            // No subscriptions.freeze_approve: approval-only plans are escalated to a manager.
            'subscriptions.view', 'subscriptions.create', 'subscriptions.renew', 'subscriptions.upgrade', 'subscriptions.freeze', 'subscriptions.stop', 'subscriptions.force_refund',
            'payments.view', 'payments.create',
            'products.view',
            'sales.view', 'sales.create',
            'reports.view',
            'expenses.view', 'expenses.create',
            'commissions.earn_sales',
            'attendance.view', 'attendance.create',
            'dashboard.view',
            'notifications.view',
        ];

        // Captain — floor staff: view ops + shift desk operate (same money tracking needs as cashier).
        $captainPermissions = [
            'members.view',
            'plans.view',
            'subscriptions.view',
            'payments.view', 'payments.create',
            'reports.view',
            'expenses.view', 'expenses.create',
            'commissions.view', 'commissions.earn_sales',
            'attendance.view', 'attendance.create',
            'dashboard.view',
            'notifications.view',
        ];

        // Accountant permissions
        $accountantPermissions = [
            'plans.view',
            'payments.view', 'payments.create',
            'products.view',
            'sales.view',
            'reports.view',
            'employees.view',
            'commissions.view',
            'payroll.view',
            'expenses.view', 'expenses.create', 'expenses.update', 'expenses.delete',
            'attendance.view',
            'dashboard.view',
            'audit.view',
            'notifications.view',
        ];

        // 4. Append export permissions dynamically based on the view permissions
        // Rule: export.{resource} granted iff role holds that resource's view permission
        $roleMappings = [
            ['role' => $managerRole, 'permissions' => &$managerPermissions],
            ['role' => $cashierRole, 'permissions' => &$cashierPermissions],
            ['role' => $captainRole, 'permissions' => &$captainPermissions],
            ['role' => $accountantRole, 'permissions' => &$accountantPermissions],
        ];

        foreach ($roleMappings as &$mapping) {
            $roleObj = $mapping['role'];
            $permList = &$mapping['permissions'];
            foreach (SystemPermissions::EXPORT_VIEW_PERMISSION_MAP as $resource => $viewPerm) {
                if (in_array($viewPerm, $permList, true)) {
                    $exportPerm = SystemPermissions::EXPORT_PERMISSION_MAP[$resource];
                    $permList[] = $exportPerm;
                }
            }
            $roleObj->syncPermissions($permList);
        }

        // Forget cache once more to seal the changes
        app()[PermissionRegistrar::class]->forgetCachedPermissions();
    }
}
