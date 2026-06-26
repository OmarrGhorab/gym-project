<?php

namespace App\Policies;

use App\Models\MemberVisit;
use App\Models\User;
use App\Support\MembershipPermissions;

class MemberVisitPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermissionTo(MembershipPermissions::PERM_MEMBERS_VIEW);
    }

    public function view(User $user, MemberVisit $memberVisit): bool
    {
        return $user->hasPermissionTo(MembershipPermissions::PERM_MEMBERS_VIEW);
    }

    public function create(User $user): bool
    {
        return $user->hasPermissionTo(MembershipPermissions::PERM_MEMBERS_UPDATE);
    }

    public function update(User $user, MemberVisit $memberVisit): bool
    {
        return $user->hasPermissionTo(MembershipPermissions::PERM_MEMBERS_UPDATE);
    }

    public function delete(User $user, MemberVisit $memberVisit): bool
    {
        return $user->hasPermissionTo(MembershipPermissions::PERM_MEMBERS_DELETE);
    }
}
