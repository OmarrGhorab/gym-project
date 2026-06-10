<?php

namespace Database\Seeders;

use App\Support\FoundationPermissions;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

/**
 * Seeds the foundation roles and permissions required by Phase 0.
 *
 * Roles   : Admin, Manager, Cashier, Captain, Accountant
 * Permissions: foundation.access-sample (assigned to Admin)
 *
 * Idempotent — uses firstOrCreate so re-running does not create duplicates.
 * Later phases call their own seeders; they do not modify this seeder.
 */
class FoundationAccessSeeder extends Seeder
{
    public function run(): void
    {
        // Spatie caches permission lookups; clear before seeding to avoid
        // stale-cache issues in development and test environments.
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        // Create all foundation permissions first so role assignment works.
        foreach (FoundationPermissions::ALL_PERMISSIONS as $permissionName) {
            Permission::firstOrCreate(
                ['name' => $permissionName, 'guard_name' => 'web'],
            );
        }

        // Create all foundation roles.
        $roles = [];
        foreach (FoundationPermissions::ALL_ROLES as $roleName) {
            $roles[$roleName] = Role::firstOrCreate(
                ['name' => $roleName, 'guard_name' => 'web'],
            );
        }

        // Assign the foundation.access-sample permission to the Admin role.
        // The Admin role has full foundation access; other roles gain their
        // permissions when later phases seed module-specific capabilities.
        $roles[FoundationPermissions::ROLE_ADMIN]->givePermissionTo(
            FoundationPermissions::PERM_ACCESS_SAMPLE,
        );
    }
}
