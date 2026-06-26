<?php

namespace App\Actions\Attendance;

use App\Models\Attendance;

final class UpdateAttendance
{
    public function handle(Attendance $attendance, array $data): Attendance
    {
        $attendance->update($data);
        $attendance->load('employee');

        return $attendance;
    }
}
