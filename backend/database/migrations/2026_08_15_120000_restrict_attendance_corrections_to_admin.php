<?php

use App\Support\FoundationPermissions;
use App\Support\HrFinancePermissions;
use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

/**
 * Correcting attendance by hand becomes Admin-only.
 *
 * Writing or deleting an attendance row is not a scan — it puts hours on a day
 * nobody clocked in for, and payroll reads those hours. Every role but Admin
 * loses it, by exclusion rather than by name: a live database carries roles
 * that were created after the presets (the gym runs Admin plus a reception
 * role), and naming the presets would walk straight past them.
 */
return new class extends Migration
{
    public function up(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $corrections = $this->correctionPermissions();

        if ($corrections->isEmpty()) {
            return;
        }

        Role::query()
            ->where('guard_name', 'web')
            ->where('name', '!=', FoundationPermissions::ROLE_ADMIN)
            ->each(fn (Role $role) => $role->revokePermissionTo($corrections));

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function down(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $corrections = $this->correctionPermissions();

        if ($corrections->isEmpty()) {
            return;
        }

        // Only Manager held these before; roles that were granted them by hand
        // cannot be told apart from roles that never had them, so they stay off.
        Role::query()
            ->where('guard_name', 'web')
            ->where('name', FoundationPermissions::ROLE_MANAGER)
            ->each(fn (Role $role) => $role->givePermissionTo($corrections));

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    /** @return \Illuminate\Database\Eloquent\Collection<int, Permission> */
    private function correctionPermissions()
    {
        return Permission::query()
            ->where('guard_name', 'web')
            ->whereIn('name', [
                HrFinancePermissions::PERM_ATTENDANCE_UPDATE,
                HrFinancePermissions::PERM_ATTENDANCE_DELETE,
            ])
            ->get();
    }
};
