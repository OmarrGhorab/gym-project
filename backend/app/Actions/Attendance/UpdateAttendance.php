<?php

namespace App\Actions\Attendance;

use App\Models\Attendance;
use App\Models\EmployeeShift;
use Illuminate\Support\Carbon;

final class UpdateAttendance
{
    public function __construct(
        private readonly ResolveEmployeeOffDay $resolveOffDay,
        private readonly ResolveAttendanceTiming $timing,
        private readonly SyncAttendancePenalties $penalties,
    ) {}

    public function handle(Attendance $attendance, array $data): Attendance
    {
        // Defaults to true so an untouched checkbox never quietly waives a penalty
        // the record already earned.
        $applyPenalty = (bool) ($data['apply_penalty'] ?? true);
        unset($data['apply_penalty']);

        $shiftId = $data['shift_id'] ?? $attendance->shift_id;
        $dateValue = $data['date'] ?? $attendance->date;
        $shift = $shiftId ? EmployeeShift::query()->find($shiftId) : null;
        $date = $dateValue ? Carbon::parse($dateValue) : null;
        $employee = $attendance->employee ?? $attendance->employee()->first();
        $shift ??= $employee?->shift;
        $isOffDay = $employee && $shift && $date && $this->resolveOffDay->handle($employee, $date, $shift);

        if ($isOffDay) {
            $data['schedule_status'] = 'off_day';

            if (($data['status'] ?? $attendance->status) === 'absent') {
                $data['status'] = 'excused';
                $data['approval_status'] = 'approved';
                $data['notes'] = trim(($data['notes'] ?? $attendance->notes ?? '').' Off day per shift policy.');
            }

            if (in_array(($data['status'] ?? $attendance->status), ['present', 'late'], true) && $shift->off_day_bonus_enabled) {
                $data['off_day_bonus_amount'] = $shift->off_day_bonus_amount;
            }
        }

        // Recompute from the corrected clock times, so fixing a wrong scan also
        // fixes the minutes that drive payroll — in both directions.
        $data = $this->withDerivedTiming($data, $shift, $date, $isOffDay);

        $attendance->update($data);
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

        // Only recompute a side the caller actually touched — an untouched
        // check_out must keep the minutes it already had.
        if (array_key_exists('check_in', $data)) {
            $data['late_minutes'] = $isOffDay || empty($data['check_in'])
                ? 0
                : $this->timing->lateMinutes($shift, $this->timing->at($businessDate, (string) $data['check_in']));
        }

        if (array_key_exists('check_out', $data)) {
            $data['early_leave_minutes'] = $isOffDay || empty($data['check_out'])
                ? 0
                : $this->timing->earlyLeaveMinutes($shift, $this->timing->at($businessDate, (string) $data['check_out']));
        }

        return $data;
    }
}
