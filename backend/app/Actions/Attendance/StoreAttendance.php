<?php

namespace App\Actions\Attendance;

use App\Models\Attendance;
use App\Models\Employee;
use App\Models\EmployeeShift;
use Illuminate\Support\Carbon;

final class StoreAttendance
{
    public function __construct(
        private readonly ResolveEmployeeOffDay $resolveOffDay,
        private readonly ResolveAttendanceTiming $timing,
        private readonly SyncAttendancePenalties $penalties,
    ) {}

    public function handle(array $data): Attendance
    {
        // Defaults to true so a hand-entered late arrival is penalised exactly like a
        // scan; the admin unticks it when they are fixing a scanner fault or a typo.
        $applyPenalty = (bool) ($data['apply_penalty'] ?? true);
        unset($data['apply_penalty']);

        $shift = isset($data['shift_id']) ? EmployeeShift::query()->find($data['shift_id']) : null;
        $date = isset($data['date']) ? Carbon::parse($data['date']) : null;
        $employee = isset($data['employee_id']) ? Employee::query()->find($data['employee_id']) : null;
        $shift ??= $employee?->shift;
        $isOffDay = $employee && $date && $this->resolveOffDay->handle($employee, $date, $shift);

        if ($isOffDay) {
            $data['schedule_status'] = 'off_day';

            if (($data['status'] ?? null) === 'absent') {
                $data['status'] = 'excused';
                $data['approval_status'] = 'approved';
                $data['notes'] = trim(($data['notes'] ?? '').' Off day per shift policy.');
            }

            if (in_array(($data['status'] ?? null), ['present', 'late'], true) && $shift?->off_day_bonus_enabled) {
                $data['off_day_bonus_amount'] = $shift->off_day_bonus_amount;
            }
        }

        // Derive the same lateness the scanner would have recorded, so a manually
        // entered arrival is not silently free of late minutes.
        $data = $this->withDerivedTiming($data, $shift, $date, $isOffDay);

        $attendance = Attendance::create($data);
        $this->penalties->handle($attendance, $applyPenalty && ! $isOffDay);
        $attendance->load('employee');

        return $attendance;
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function withDerivedTiming(array $data, ?EmployeeShift $shift, ?Carbon $date, bool $isOffDay): array
    {
        if (! $date) {
            return $data;
        }

        $businessDate = $date->toDateString();

        if (! empty($data['check_in'])) {
            $data['late_minutes'] = $isOffDay
                ? 0
                : $this->timing->lateMinutes($shift, $this->timing->at($businessDate, (string) $data['check_in']));
        }

        if (! empty($data['check_out'])) {
            $data['early_leave_minutes'] = $isOffDay
                ? 0
                : $this->timing->earlyLeaveMinutes($shift, $this->timing->at($businessDate, (string) $data['check_out']));
        }

        return $data;
    }
}
