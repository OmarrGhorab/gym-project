<?php

namespace App\Policies;

use App\Models\Payment;
use App\Models\User;
use App\Support\MembershipPermissions;

class PaymentPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can(MembershipPermissions::PERM_PAYMENTS_VIEW);
    }

    public function view(User $user, Payment $payment): bool
    {
        return $user->can(MembershipPermissions::PERM_PAYMENTS_VIEW);
    }

    public function create(User $user): bool
    {
        return $user->can(MembershipPermissions::PERM_PAYMENTS_CREATE);
    }
}
