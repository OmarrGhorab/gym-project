<?php

namespace App\Policies;

use App\Models\Plan;
use App\Models\User;
use App\Support\MembershipPermissions;

final class PlanPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can(MembershipPermissions::PERM_PLANS_VIEW);
    }

    public function view(User $user, Plan $plan): bool
    {
        return $user->can(MembershipPermissions::PERM_PLANS_VIEW);
    }

    public function create(User $user): bool
    {
        return $user->can(MembershipPermissions::PERM_PLANS_CREATE);
    }

    public function update(User $user, Plan $plan): bool
    {
        return $user->can(MembershipPermissions::PERM_PLANS_UPDATE);
    }

    public function delete(User $user, Plan $plan): bool
    {
        return $user->can(MembershipPermissions::PERM_PLANS_DELETE);
    }
}
