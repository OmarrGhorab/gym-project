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

    /**
     * Writing an attendance row by hand is a correction, not a scan: nobody
     * clocked in for it and the desk can put any hours it likes on it. It is
     * held to the same bar as editing an existing record, so the front desk
     * (which scans, and so holds attendance.create) cannot author days.
     */
    public function createManual(User $user): bool
    {
        return $user->hasPermissionTo(HrFinancePermissions::PERM_ATTENDANCE_UPDATE);
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
