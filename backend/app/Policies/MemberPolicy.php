<?php

namespace App\Policies;

use App\Models\Member;
use App\Models\User;
use App\Support\MembershipPermissions;

class MemberPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermissionTo(MembershipPermissions::PERM_MEMBERS_VIEW);
    }

    public function view(User $user, Member $member): bool
    {
        return $user->hasPermissionTo(MembershipPermissions::PERM_MEMBERS_VIEW);
    }

    public function create(User $user): bool
    {
        return $user->hasPermissionTo(MembershipPermissions::PERM_MEMBERS_CREATE);
    }

    public function update(User $user, Member $member): bool
    {
        return $user->hasPermissionTo(MembershipPermissions::PERM_MEMBERS_UPDATE);
    }

    public function delete(User $user, Member $member): bool
    {
        return $user->hasPermissionTo(MembershipPermissions::PERM_MEMBERS_DELETE);
    }
}
