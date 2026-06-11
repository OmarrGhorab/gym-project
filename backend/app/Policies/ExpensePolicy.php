<?php

namespace App\Policies;

use App\Models\Expense;
use App\Models\User;
use App\Support\HrFinancePermissions;

class ExpensePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermissionTo(HrFinancePermissions::PERM_EXPENSES_VIEW);
    }

    public function view(User $user, Expense $expense): bool
    {
        return $user->hasPermissionTo(HrFinancePermissions::PERM_EXPENSES_VIEW);
    }

    public function create(User $user): bool
    {
        return $user->hasPermissionTo(HrFinancePermissions::PERM_EXPENSES_CREATE);
    }

    public function update(User $user, Expense $expense): bool
    {
        return $user->hasPermissionTo(HrFinancePermissions::PERM_EXPENSES_UPDATE);
    }

    public function delete(User $user, Expense $expense): bool
    {
        return $user->hasPermissionTo(HrFinancePermissions::PERM_EXPENSES_DELETE);
    }
}
