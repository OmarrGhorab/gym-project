<?php

namespace App\Actions\Overtime;

use App\Actions\Attendance\ResolveEmployeeOffDay;
use App\Models\Attendance;
use App\Models\Employee;
use App\Models\OvertimeShift;
use Illuminate\Support\Carbon;

/**
 * Employees who were scheduled on a working day but never checked in.
 *
 * Their shift is the slot another employee can pick up as overtime.
 */
class ResolveUncoveredShifts
{
    public function __construct(
        private readonly ResolveEmployeeOffDay $offDay,
    ) {}

    /**
     * @return list<array<string, mixed>>
     */
    public function handle(Carbon $date): array
    {
        $scheduled = Employee::query()
            ->active()
            ->whereNotNull('shift_id')
            ->with('shift')
            ->orderBy('name')
            ->get()
            ->filter(fn (Employee $employee): bool => (bool) $employee->shift?->is_active);

        if ($scheduled->isEmpty()) {
            return [];
        }

        $checkedInIds = Attendance::query()
            ->whereIn('employee_id', $scheduled->pluck('id'))
            ->whereDate('date', $date->toDateString())
            ->whereNotNull('check_in')
            ->pluck('employee_id')
            ->map(fn ($id): int => (int) $id)
            ->all();

        $covers = OvertimeShift::query()
            ->activeClaim()
            ->whereDate('date', $date->toDateString())
            ->whereNotNull('covering_for_employee_id')
            ->with('employee:id,name,role')
            ->get()
            ->keyBy('covering_for_employee_id');

        $rows = [];

        foreach ($scheduled as $employee) {
            if (in_array((int) $employee->id, $checkedInIds, true)) {
                continue;
            }

            if ($this->offDay->handle($employee, $date, $employee->shift)) {
                continue;
            }

            $cover = $covers->get($employee->id);

            $rows[] = [
                'employee' => [
                    'id' => $employee->id,
                    'name' => $employee->name,
                    'role' => $employee->role,
                ],
                'shift' => $employee->shift ? [
                    'id' => $employee->shift->id,
                    'name' => $employee->shift->name,
                    'starts_at' => $employee->shift->starts_at?->format('H:i'),
                    'ends_at' => $employee->shift->ends_at?->format('H:i'),
                ] : null,
                'date' => $date->toDateString(),
                'covered_by' => $cover ? [
                    'overtime_shift_id' => $cover->id,
                    'employee_id' => $cover->employee_id,
                    'employee_name' => $cover->employee?->name,
                    'status' => $cover->status,
                ] : null,
            ];
        }

        return $rows;
    }
}
