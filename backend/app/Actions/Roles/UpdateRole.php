<?php

namespace App\Actions\Roles;

use App\Models\User;
use App\Support\SystemPermissions;
use Illuminate\Validation\ValidationException;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

final class UpdateRole
{
    public function handle(Role $role, array $data): Role
    {
        // Lock-out guard: refuse stripping roles.manage if it's the last role holding it
        $hasRolesManage = $role->hasPermissionTo(SystemPermissions::PERM_ROLES_MANAGE);
        $willHaveRolesManage = in_array(SystemPermissions::PERM_ROLES_MANAGE, $data['permissions'] ?? [], true);

        if ($hasRolesManage && ! $willHaveRolesManage) {
            $usersWithPerm = User::permission(SystemPermissions::PERM_ROLES_MANAGE)
                ->with('roles.permissions')
                ->get();
            $anyUserRetains = false;

            foreach ($usersWithPerm as $user) {
                if ($user->hasDirectPermission(SystemPermissions::PERM_ROLES_MANAGE)) {
                    $anyUserRetains = true;
                    break;
                }
                foreach ($user->roles as $otherRole) {
                    if ($otherRole->id === $role->id) {
                        continue;
                    }
                    if ($otherRole->permissions->contains('name', SystemPermissions::PERM_ROLES_MANAGE)) {
                        $anyUserRetains = true;
                        break 2;
                    }
                }
            }

            if (! $anyUserRetains) {
                throw ValidationException::withMessages([
                    'permissions' => ['Cannot remove role management permission from the last role holding it.'],
                ]);
            }
        }

        $role->update([
            'name' => $data['name'],
        ]);

        if (isset($data['permissions'])) {
            $role->syncPermissions($data['permissions']);
        }

        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        return $role;
    }
}
