<?php

namespace App\Actions\ShiftSessions;

use App\Models\Employee;
use App\Models\EmployeeShift;
use App\Models\User;
use App\Support\FoundationPermissions;
use Illuminate\Validation\ValidationException;

/**
 * Decides which employee is accountable for a shift session.
 *
 * Shifts are only names now, so anybody active can be put on any desk — who is
 * on duty is a decision the person opening the drawer makes, not something a
 * schedule dictates. What still holds is that a non-admin can only put
 * themselves on the hook: the session records the real employee handling the
 * money, never the admin acting for them.
 */
class ResolveShiftStaff
{
    public function handle(
        EmployeeShift $shift,
        User $user,
        ?int $employeeId = null,
        string $field = 'employee_id',
        bool $allowNonAdminNomination = false,
    ): Employee {
        $actor = Employee::query()->where('user_id', $user->id)->first();
        $canNominate = $allowNonAdminNomination || $this->canNominate($user);

        if ($employeeId !== null) {
            $employee = Employee::query()->find($employeeId);

            if (! $employee) {
                throw ValidationException::withMessages([
                    $field => 'That employee no longer exists.',
                ]);
            }

            if (! $canNominate && (! $actor || (int) $actor->id !== (int) $employee->id)) {
                throw ValidationException::withMessages([
                    $field => 'You can only open or close a shift session as yourself.',
                ]);
            }

            return $this->assertActive($employee, $field);
        }

        if ($actor) {
            return $this->assertActive($actor, $field);
        }

        throw ValidationException::withMessages([
            $field => 'Select which employee is on duty for '.$shift->name.'.',
        ]);
    }

    private function canNominate(User $user): bool
    {
        if (! method_exists($user, 'hasRole')) {
            return false;
        }

        return $user->hasRole(FoundationPermissions::ROLE_ADMIN)
            || $user->hasRole(FoundationPermissions::ROLE_MANAGER);
    }

    private function assertActive(Employee $employee, string $field): Employee
    {
        if ($employee->status !== 'active') {
            throw ValidationException::withMessages([
                $field => $employee->name.' is not an active employee.',
            ]);
        }

        return $employee;
    }
}
