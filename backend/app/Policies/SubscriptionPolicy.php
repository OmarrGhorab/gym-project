<?php

namespace App\Policies;

use App\Models\Subscription;
use App\Models\User;
use App\Support\MembershipPermissions;

class SubscriptionPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can(MembershipPermissions::PERM_SUBSCRIPTIONS_VIEW);
    }

    public function view(User $user, Subscription $subscription): bool
    {
        return $user->can(MembershipPermissions::PERM_SUBSCRIPTIONS_VIEW);
    }

    public function create(User $user): bool
    {
        return $user->can(MembershipPermissions::PERM_SUBSCRIPTIONS_CREATE);
    }

    public function renew(User $user, Subscription $subscription): bool
    {
        return $user->can(MembershipPermissions::PERM_SUBSCRIPTIONS_RENEW);
    }

    public function upgrade(User $user, Subscription $subscription): bool
    {
        return $user->can(MembershipPermissions::PERM_SUBSCRIPTIONS_UPGRADE);
    }

    public function freeze(User $user, Subscription $subscription): bool
    {
        return $user->can(MembershipPermissions::PERM_SUBSCRIPTIONS_FREEZE);
    }

    public function stop(User $user, Subscription $subscription): bool
    {
        return $user->can(MembershipPermissions::PERM_SUBSCRIPTIONS_STOP);
    }
}
