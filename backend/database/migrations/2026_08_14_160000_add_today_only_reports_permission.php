<?php

use App\Support\FoundationPermissions;
use App\Support\PosPermissions;
use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

return new class extends Migration
{
    public function up(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $permission = Permission::query()->firstOrCreate([
            'name' => PosPermissions::PERM_REPORTS_VIEW_TODAY,
            'guard_name' => 'web',
        ]);

        Role::query()
            ->where('name', FoundationPermissions::ROLE_ADMIN)
            ->where('guard_name', 'web')
            ->each(fn (Role $role) => $role->givePermissionTo($permission));

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function down(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        Permission::query()
            ->where('name', PosPermissions::PERM_REPORTS_VIEW_TODAY)
            ->where('guard_name', 'web')
            ->delete();

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
};
