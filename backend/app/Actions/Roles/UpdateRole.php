<?php

namespace App\Actions\Roles;

use App\Models\User;
use App\Support\SystemPermissions;
use Illuminate\Http\Exceptions\HttpResponseException;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

final class UpdateRole
{
    public function handle(Role $role, array $data): Role
    {
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        // Lock-out guard: refuse stripping roles.manage if it's the last role holding it
        $hasRolesManage = $role->hasPermissionTo(SystemPermissions::PERM_ROLES_MANAGE);
        $willHaveRolesManage = in_array(SystemPermissions::PERM_ROLES_MANAGE, $data['permissions'] ?? [], true);

        if ($hasRolesManage && ! $willHaveRolesManage) {
            $usersWithPerm = User::permission(SystemPermissions::PERM_ROLES_MANAGE)->get();
            $anyUserRetains = false;

            foreach ($usersWithPerm as $user) {
                if ($user->hasDirectPermission(SystemPermissions::PERM_ROLES_MANAGE)) {
                    $anyUserRetains = true;
                    break;
                }
                $otherRoles = $user->roles()->where('roles.id', '!=', $role->id)->get();
                foreach ($otherRoles as $otherRole) {
                    if ($otherRole->hasPermissionTo(SystemPermissions::PERM_ROLES_MANAGE)) {
                        $anyUserRetains = true;
                        break 2;
                    }
                }
            }

            if (! $anyUserRetains) {
                throw new HttpResponseException(
                    response()->json([
                        'error' => [
                            'code' => 'validation_failed',
                            'message' => 'Cannot remove role management permission from the last role holding it.',
                            'details' => (object) [],
                        ],
                    ], 422)
                );
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
