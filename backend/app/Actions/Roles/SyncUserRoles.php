<?php

namespace App\Actions\Roles;

use App\Models\User;
use App\Support\SystemPermissions;
use Illuminate\Validation\ValidationException;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

final class SyncUserRoles
{
    public function handle(User $user, array $data): User
    {
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        // Lock-out guard: check if user currently has roles.manage
        if ($user->hasPermissionTo(SystemPermissions::PERM_ROLES_MANAGE)) {
            // Count OTHER users with roles.manage
            $otherUsersCount = User::where('users.id', '!=', $user->id)
                ->permission(SystemPermissions::PERM_ROLES_MANAGE)
                ->count();

            if ($otherUsersCount === 0) {
                // This is the last user. Ensure they retain roles.manage.
                $hasDirect = $user->hasDirectPermission(SystemPermissions::PERM_ROLES_MANAGE);
                $anyNewRoleGrants = false;

                foreach ($data['roles'] as $roleName) {
                    $roleObj = Role::findByName($roleName, 'web');
                    if ($roleObj && $roleObj->hasPermissionTo(SystemPermissions::PERM_ROLES_MANAGE)) {
                        $anyNewRoleGrants = true;
                        break;
                    }
                }

                if (! $hasDirect && ! $anyNewRoleGrants) {
                    throw ValidationException::withMessages([
                        'roles' => ['Cannot remove role management permissions from the last user holding them.'],
                    ]);
                }
            }
        }

        $user->syncRoles($data['roles']);

        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        return $user;
    }
}
