<?php

namespace App\Policies;

use App\Models\Attendance;
use App\Models\User;
use App\Support\HrFinancePermissions;

class AttendancePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermissionTo(HrFinancePermissions::PERM_ATTENDANCE_VIEW);
    }

    public function view(User $user, Attendance $attendance): bool
    {
        return $user->hasPermissionTo(HrFinancePermissions::PERM_ATTENDANCE_VIEW);
    }

    public function create(User $user): bool
    {
        return $user->hasPermissionTo(HrFinancePermissions::PERM_ATTENDANCE_CREATE);
    }

    public function update(User $user, Attendance $attendance): bool
    {
        return $user->hasPermissionTo(HrFinancePermissions::PERM_ATTENDANCE_UPDATE);
    }

    public function delete(User $user, Attendance $attendance): bool
    {
        return $user->hasPermissionTo(HrFinancePermissions::PERM_ATTENDANCE_DELETE);
    }
}
