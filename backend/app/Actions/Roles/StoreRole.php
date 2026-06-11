<?php

namespace App\Actions\Roles;

use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

final class StoreRole
{
    public function handle(array $data): Role
    {
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        $role = Role::create([
            'name' => $data['name'],
            'guard_name' => 'web',
        ]);

        if (isset($data['permissions'])) {
            $role->syncPermissions($data['permissions']);
        }

        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        return $role;
    }
}
