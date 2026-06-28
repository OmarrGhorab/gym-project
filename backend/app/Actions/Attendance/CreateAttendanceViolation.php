<?php

namespace App\Actions\Attendance;

use App\Models\Attendance;
use App\Models\AttendanceViolation;
use App\Models\AttendanceViolationRule;
use Illuminate\Support\Carbon;

final class CreateAttendanceViolation
{
    public function handle(
        Attendance $attendance,
        string $type,
        ?int $minutes = null,
        ?string $notes = null,
    ): ?AttendanceViolation {
        $rule = $this->ruleFor($type, $minutes);

        if (! $rule) {
            return null;
        }

        return AttendanceViolation::query()->updateOrCreate(
            [
                'attendance_id' => $attendance->id,
                'type' => $type,
            ],
            [
                'employee_id' => $attendance->employee_id,
                'attendance_violation_rule_id' => $rule->id,
                'violation_date' => Carbon::parse($attendance->date)->toDateString(),
                'minutes' => $minutes,
                'deduction_days' => $rule->deduction_days,
                'deduction_amount' => '0.00',
                'status' => $rule->requires_admin_approval ? 'pending' : 'approved',
                'notes' => $notes,
            ]
        );
    }

    private function ruleFor(string $type, ?int $minutes): ?AttendanceViolationRule
    {
        if ($type === 'late') {
            return AttendanceViolationRule::query()
                ->where('is_active', true)
                ->where('code', 'like', 'late_%')
                ->where('threshold_minutes', '<=', $minutes ?? 0)
                ->orderByDesc('threshold_minutes')
                ->first();
        }

        return AttendanceViolationRule::query()
            ->where('is_active', true)
            ->where('code', $type)
            ->first();
    }
}
