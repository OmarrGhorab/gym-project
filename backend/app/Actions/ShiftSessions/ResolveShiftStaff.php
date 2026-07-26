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
 * A session may only be opened or closed by an employee assigned to that shift.
 * An admin can act on their behalf, but must name the employee who is actually
 * on duty — the session always records a real shift member, never the admin.
 */
class ResolveShiftStaff
{
    public function handle(EmployeeShift $shift, User $user, ?int $employeeId = null, string $field = 'employee_id'): Employee
    {
        $actor = Employee::query()->where('user_id', $user->id)->first();
        $isAdmin = method_exists($user, 'hasRole') && $user->hasRole(FoundationPermissions::ROLE_ADMIN);

        if ($employeeId !== null) {
            $employee = Employee::query()->find($employeeId);

            if (! $employee) {
                throw ValidationException::withMessages([
                    $field => 'That employee no longer exists.',
                ]);
            }

            // Only an admin may nominate somebody other than themselves.
            if (! $isAdmin && (! $actor || (int) $actor->id !== (int) $employee->id)) {
                throw ValidationException::withMessages([
                    $field => 'You can only open or close a shift session as yourself.',
                ]);
            }

            return $this->assertEligible($employee, $shift, $field);
        }

        if ($actor && (int) $actor->shift_id === (int) $shift->id) {
            return $this->assertEligible($actor, $shift, $field);
        }

        throw ValidationException::withMessages([
            $field => $isAdmin
                ? 'Select which employee of '.$shift->name.' is on duty.'
                : 'Only employees assigned to '.$shift->name.' can open or close its session.',
        ]);
    }

    private function assertEligible(Employee $employee, EmployeeShift $shift, string $field): Employee
    {
        if ((int) $employee->shift_id !== (int) $shift->id) {
            throw ValidationException::withMessages([
                $field => $employee->name.' is not assigned to '.$shift->name.'.',
            ]);
        }

        if ($employee->status !== 'active') {
            throw ValidationException::withMessages([
                $field => $employee->name.' is not an active employee.',
            ]);
        }

        return $employee;
    }
}
