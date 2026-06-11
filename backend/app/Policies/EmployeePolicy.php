<?php

namespace App\Policies;

use App\Models\Employee;
use App\Models\User;
use App\Support\HrFinancePermissions;

class EmployeePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermissionTo(HrFinancePermissions::PERM_EMPLOYEES_VIEW);
    }

    public function view(User $user, Employee $employee): bool
    {
        return $user->hasPermissionTo(HrFinancePermissions::PERM_EMPLOYEES_VIEW);
    }

    public function create(User $user): bool
    {
        return $user->hasPermissionTo(HrFinancePermissions::PERM_EMPLOYEES_CREATE);
    }

    public function update(User $user, Employee $employee): bool
    {
        return $user->hasPermissionTo(HrFinancePermissions::PERM_EMPLOYEES_UPDATE);
    }

    public function delete(User $user, Employee $employee): bool
    {
        return $user->hasPermissionTo(HrFinancePermissions::PERM_EMPLOYEES_DELETE);
    }
}
