<?php

namespace App\Actions\Attendance;

use App\Models\Attendance;

final class StoreAttendance
{
    public function handle(array $data): Attendance
    {
        $attendance = Attendance::create($data);
        $attendance->load(['employee', 'shift']);

        return $attendance;
    }
}
