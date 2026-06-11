<?php

namespace App\Policies;

use App\Models\Sale;
use App\Models\User;
use App\Support\PosPermissions;

class SalePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can(PosPermissions::PERM_SALES_VIEW);
    }

    public function view(User $user, Sale $sale): bool
    {
        return $user->can(PosPermissions::PERM_SALES_VIEW);
    }

    public function create(User $user): bool
    {
        return $user->can(PosPermissions::PERM_SALES_CREATE);
    }

    public function void(User $user, Sale $sale): bool
    {
        return $user->can(PosPermissions::PERM_SALES_VOID);
    }
}
