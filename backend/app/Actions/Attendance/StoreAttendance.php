<?php

namespace App\Actions\Attendance;

use App\Models\Attendance;
use App\Models\EmployeeShift;
use Illuminate\Support\Carbon;

final class StoreAttendance
{
    public function handle(array $data): Attendance
    {
        $shift = isset($data['shift_id']) ? EmployeeShift::query()->find($data['shift_id']) : null;
        $date = isset($data['date']) ? Carbon::parse($data['date']) : null;

        if ($shift && $date && $this->isOffDay($shift, $date)) {
            $data['schedule_status'] = 'off_day';

            if (($data['status'] ?? null) === 'absent') {
                $data['status'] = 'excused';
                $data['approval_status'] = 'approved';
                $data['notes'] = trim(($data['notes'] ?? '').' Off day per shift policy.');
            }

            if (in_array(($data['status'] ?? null), ['present', 'late'], true) && $shift->off_day_bonus_enabled) {
                $data['off_day_bonus_amount'] = $shift->off_day_bonus_amount;
            }
        }

        $attendance = Attendance::create($data);
        $attendance->load('employee');

        return $attendance;
    }

    private function isOffDay(EmployeeShift $shift, Carbon $date): bool
    {
        if (empty($shift->off_days)) {
            return false;
        }

        return in_array((int) $date->dayOfWeek, array_map('intval', $shift->off_days), true);
    }
}
