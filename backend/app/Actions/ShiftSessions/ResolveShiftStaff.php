<?php

namespace App\Actions\ShiftSessions;

use App\Models\Employee;
use App\Models\EmployeeShift;
use App\Models\OvertimeShift;
use App\Models\User;
use App\Support\FoundationPermissions;
use Illuminate\Support\Carbon;
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
    public function handle(
        EmployeeShift $shift,
        User $user,
        ?int $employeeId = null,
        string $field = 'employee_id',
        Carbon|string|null $businessDate = null,
    ): Employee {
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

            return $this->assertEligible($employee, $shift, $field, $businessDate);
        }

        if ($actor) {
            return $this->assertEligible($actor, $shift, $field, $businessDate);
        }

        throw ValidationException::withMessages([
            $field => $isAdmin
                ? 'Select which employee of '.$shift->name.' is on duty.'
                : 'Only employees assigned to '.$shift->name.' can open or close its session.',
        ]);
    }

    private function assertEligible(Employee $employee, EmployeeShift $shift, string $field, Carbon|string|null $businessDate): Employee
    {
        $date = $businessDate ? Carbon::parse($businessDate)->toDateString() : Carbon::today()->toDateString();
        $isAssigned = (int) $employee->shift_id === (int) $shift->id;
        $isCovering = OvertimeShift::query()
            ->activeClaim()
            ->where('employee_id', $employee->id)
            ->where('employee_shift_id', $shift->id)
            ->whereDate('date', $date)
            ->exists();

        if (! $isAssigned && ! $isCovering) {
            throw ValidationException::withMessages([
                $field => $employee->name.' is not assigned to or scheduled to cover '.$shift->name.' on '.$date.'.',
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
