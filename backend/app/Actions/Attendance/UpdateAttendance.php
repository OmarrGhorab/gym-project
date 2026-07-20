<?php

namespace App\Actions\Attendance;

use App\Models\Attendance;
use App\Models\EmployeeShift;
use Illuminate\Support\Carbon;

final class UpdateAttendance
{
    public function __construct(
        private readonly ResolveEmployeeOffDay $resolveOffDay,
    ) {}

    public function handle(Attendance $attendance, array $data): Attendance
    {
        $shiftId = $data['shift_id'] ?? $attendance->shift_id;
        $dateValue = $data['date'] ?? $attendance->date;
        $shift = $shiftId ? EmployeeShift::query()->find($shiftId) : null;
        $date = $dateValue ? Carbon::parse($dateValue) : null;
        $employee = $attendance->employee ?? $attendance->employee()->first();

        if ($employee && $shift && $date && $this->resolveOffDay->handle($employee, $date, $shift)) {
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

        $attendance->update($data);
        $attendance->load('employee');

        return $attendance;
    }
}
