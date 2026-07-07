<?php

namespace App\Policies;

use App\Models\Expense;
use App\Models\User;
use App\Support\HrFinancePermissions;
use Illuminate\Auth\Access\Response;

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

    public function update(User $user, Expense $expense): bool|Response
    {
        if ($this->isPayrollExpense($expense)) {
            return Response::deny('Payroll payout expenses are locked. Reverse or adjust the payroll receipt instead.');
        }

        return $user->hasPermissionTo(HrFinancePermissions::PERM_EXPENSES_UPDATE);
    }

    public function delete(User $user, Expense $expense): bool|Response
    {
        if ($this->isPayrollExpense($expense)) {
            return Response::deny('Payroll payout expenses are locked. Reverse or adjust the payroll receipt instead.');
        }

        return $user->hasPermissionTo(HrFinancePermissions::PERM_EXPENSES_DELETE);
    }

    private function isPayrollExpense(Expense $expense): bool
    {
        return strtolower(trim($expense->category)) === 'payroll';
    }
}
