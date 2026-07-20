<?php

namespace App\Actions\Attendance;

use App\Models\Employee;
use App\Models\EmployeeOffDayOverride;
use App\Models\EmployeeShift;
use App\Models\ShiftOffRotation;
use Illuminate\Support\Carbon;

class ResolveEmployeeOffDay
{
    /**
     * Determine whether an employee is off on a given date.
     *
     * Priority:
     * 1. Explicit override for that employee/date
     * 2. Active rotation for the employee's shift (one person off on the weekday per week)
     * 3. Static shift.off_days for everyone on the shift
     */
    public function handle(Employee $employee, Carbon $date, ?EmployeeShift $shift = null): bool
    {
        $shift ??= $employee->relationLoaded('shift')
            ? $employee->shift
            : $employee->shift()->first();

        $override = EmployeeOffDayOverride::query()
            ->where('employee_id', $employee->id)
            ->whereDate('date', $date->toDateString())
            ->first();

        if ($override) {
            return $override->type === 'off';
        }

        if ($shift) {
            $rotation = ShiftOffRotation::query()
                ->where('employee_shift_id', $shift->id)
                ->where('is_active', true)
                ->first();

            if ($rotation && ! empty($rotation->employee_order)) {
                return $this->isRotationOffDay($employee, $date, $rotation);
            }

            if (! empty($shift->off_days)) {
                return in_array((int) $date->dayOfWeek, array_map('intval', $shift->off_days), true);
            }
        }

        return false;
    }

    /**
     * Preview who is off on the rotation weekday for the next N weeks.
     *
     * @return list<array{week_start: string, off_date: string, employee_id: int|null}>
     */
    public function preview(ShiftOffRotation $rotation, int $weeks = 8): array
    {
        $order = array_values(array_map('intval', $rotation->employee_order ?? []));
        if ($order === []) {
            return [];
        }

        $start = Carbon::parse($rotation->rotation_start_date)->startOfWeek(Carbon::SUNDAY);
        $preview = [];

        for ($week = 0; $week < $weeks; $week++) {
            $weekStart = $start->copy()->addWeeks($week);
            $offDate = $weekStart->copy();

            while ((int) $offDate->dayOfWeek !== (int) $rotation->off_weekday) {
                $offDate->addDay();
            }

            $assigneeId = $order[$week % count($order)] ?? null;
            $preview[] = [
                'week_start' => $weekStart->toDateString(),
                'off_date' => $offDate->toDateString(),
                'employee_id' => $assigneeId,
            ];
        }

        return $preview;
    }

    private function isRotationOffDay(Employee $employee, Carbon $date, ShiftOffRotation $rotation): bool
    {
        if ((int) $date->dayOfWeek !== (int) $rotation->off_weekday) {
            return false;
        }

        $order = array_values(array_map('intval', $rotation->employee_order ?? []));
        if ($order === []) {
            return false;
        }

        $anchor = Carbon::parse($rotation->rotation_start_date)->startOfWeek(Carbon::SUNDAY);
        $current = $date->copy()->startOfWeek(Carbon::SUNDAY);
        $weekIndex = (int) $anchor->diffInWeeks($current, false);

        if ($weekIndex < 0) {
            return false;
        }

        $assigneeId = $order[$weekIndex % count($order)];

        return (int) $employee->id === (int) $assigneeId;
    }
}
