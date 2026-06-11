<?php

namespace App\Policies;

use App\Models\Payroll;
use App\Models\User;
use App\Support\HrFinancePermissions;

class PayrollPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermissionTo(HrFinancePermissions::PERM_PAYROLL_VIEW);
    }

    public function view(User $user, Payroll $payroll): bool
    {
        return $user->hasPermissionTo(HrFinancePermissions::PERM_PAYROLL_VIEW);
    }

    public function generate(User $user): bool
    {
        return $user->hasPermissionTo(HrFinancePermissions::PERM_PAYROLL_GENERATE);
    }

    public function update(User $user, Payroll $payroll): bool
    {
        return $user->hasPermissionTo(HrFinancePermissions::PERM_PAYROLL_GENERATE);
    }

    public function pay(User $user, Payroll $payroll): bool
    {
        return $user->hasPermissionTo(HrFinancePermissions::PERM_PAYROLL_PAY);
    }
}
