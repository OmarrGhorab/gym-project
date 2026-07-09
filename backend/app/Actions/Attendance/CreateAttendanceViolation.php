<?php

namespace App\Actions\Attendance;

use App\Models\Attendance;
use App\Models\AttendanceViolation;
use App\Models\AttendanceViolationRule;
use App\Services\OperationalNotifier;
use Illuminate\Support\Carbon;

final class CreateAttendanceViolation
{
    public function __construct(
        private readonly OperationalNotifier $notifier,
    ) {}

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

        $priorViolations = AttendanceViolation::query()
            ->where('employee_id', $attendance->employee_id)
            ->where('attendance_violation_rule_id', $rule->id)
            ->where('violation_date', '<', Carbon::parse($attendance->date)->toDateString())
            ->count();

        $warningCount = max(0, (int) $rule->warning_count_before_deduction);
        $warningPhase = $priorViolations < $warningCount;
        $status = $warningPhase ? 'warning' : ($rule->requires_admin_approval ? 'pending' : 'approved');
        $deductionDays = $warningPhase ? '0.00' : (string) $rule->deduction_days;

        $violation = AttendanceViolation::query()->updateOrCreate(
            [
                'attendance_id' => $attendance->id,
                'type' => $type,
            ],
            [
                'employee_id' => $attendance->employee_id,
                'attendance_violation_rule_id' => $rule->id,
                'violation_date' => Carbon::parse($attendance->date)->toDateString(),
                'minutes' => $minutes,
                'deduction_days' => $deductionDays,
                'deduction_amount' => '0.00',
                'status' => $status,
                'notes' => $notes,
            ]
        );

        if ($violation->wasRecentlyCreated || $violation->wasChanged(['status', 'deduction_days'])) {
            $this->notifier->employeeAttendanceWarning($violation);
        }

        return $violation;
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
