<?php

namespace App\Actions\Roles;

use App\Models\User;
use App\Support\FoundationPermissions;
use App\Support\SystemPermissions;
use Illuminate\Validation\ValidationException;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

final class DeleteRole
{
    public function handle(Role $role): void
    {
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        // 1. Refuse deleting preset roles
        if (in_array($role->name, FoundationPermissions::ALL_ROLES, true)) {
            throw ValidationException::withMessages([
                'role' => ['Preset roles cannot be deleted.'],
            ]);
        }

        // 2. Lock-out guard
        if ($role->hasPermissionTo(SystemPermissions::PERM_ROLES_MANAGE)) {
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
                throw ValidationException::withMessages([
                    'role' => ['Cannot delete the last role granting role management permissions.'],
                ]);
            }
        }

        $role->delete();

        app()[PermissionRegistrar::class]->forgetCachedPermissions();
    }
}
