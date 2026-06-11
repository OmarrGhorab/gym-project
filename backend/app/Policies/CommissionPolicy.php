<?php

namespace App\Policies;

use App\Models\User;
use App\Support\HrFinancePermissions;

class CommissionPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermissionTo(HrFinancePermissions::PERM_COMMISSIONS_VIEW);
    }

    public function backfill(User $user): bool
    {
        return $user->hasPermissionTo(HrFinancePermissions::PERM_COMMISSIONS_BACKFILL);
    }
}
