<?php

namespace App\Policies;

use App\Models\User;
use App\Support\SystemPermissions;
use Spatie\Permission\Models\Role;

class RolePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermissionTo(SystemPermissions::PERM_ROLES_MANAGE);
    }

    public function view(User $user, Role $role): bool
    {
        return $user->hasPermissionTo(SystemPermissions::PERM_ROLES_MANAGE);
    }

    public function create(User $user): bool
    {
        return $user->hasPermissionTo(SystemPermissions::PERM_ROLES_MANAGE);
    }

    public function update(User $user, Role $role): bool
    {
        return $user->hasPermissionTo(SystemPermissions::PERM_ROLES_MANAGE);
    }

    public function delete(User $user, Role $role): bool
    {
        return $user->hasPermissionTo(SystemPermissions::PERM_ROLES_MANAGE);
    }

    public function assign(User $user): bool
    {
        return $user->hasPermissionTo(SystemPermissions::PERM_ROLES_MANAGE);
    }
}
