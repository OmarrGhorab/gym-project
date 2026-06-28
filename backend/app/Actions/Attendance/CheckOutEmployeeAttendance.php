<?php

namespace App\Actions\Attendance;

use App\Models\Attendance;
use App\Models\User;
use App\Support\Geofence;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;

final class CheckOutEmployeeAttendance
{
    public function __construct(
        private readonly ResolveAttendanceIdentity $identity,
        private readonly Geofence $geofence,
        private readonly CreateAttendanceViolation $violations,
    ) {}

    public function handle(array $data, User $user): Attendance
    {
        $employee = $this->identity->employee($data);
        $checkOut = Carbon::parse($data['check_out_at'] ?? now());
        $attendance = Attendance::query()
            ->where('employee_id', $employee->id)
            ->where('date', $checkOut->toDateString())
            ->first();

        if (! $attendance) {
            throw ValidationException::withMessages([
                'employee_id' => 'No attendance check-in found for this employee today.',
            ]);
        }

        $shift = $attendance->shift ?: $employee->shift;
        $location = $this->geofence->evaluate($data);
        $earlyLeaveMinutes = $this->earlyLeaveMinutes($shift, $checkOut);

        $attendance->update([
            'check_out' => $checkOut->format('H:i'),
            'check_out_latitude' => $location['latitude'],
            'check_out_longitude' => $location['longitude'],
            'check_out_accuracy_meters' => $location['accuracy_meters'],
            'check_out_distance_meters' => $location['distance_meters'],
            'check_out_location_status' => $location['location_status'],
            'early_leave_minutes' => $earlyLeaveMinutes,
            'notes' => $data['notes'] ?? $attendance->notes,
        ]);

        if ($earlyLeaveMinutes > 0) {
            $this->violations->handle($attendance, 'early_leave', $earlyLeaveMinutes, 'Early checkout detected.');
        }

        return $attendance->load(['employee.shift', 'shift']);
    }

    private function earlyLeaveMinutes($shift, Carbon $checkOut): int
    {
        if (! $shift) {
            return 0;
        }

        $start = Carbon::parse($checkOut->toDateString().' '.$shift->starts_at->format('H:i'));
        $end = Carbon::parse($checkOut->toDateString().' '.$shift->ends_at->format('H:i'));
        if ($end->lessThanOrEqualTo($start)) {
            $end->addDay();
        }

        return $checkOut->lessThan($end) ? (int) $checkOut->diffInMinutes($end) : 0;
    }
}
