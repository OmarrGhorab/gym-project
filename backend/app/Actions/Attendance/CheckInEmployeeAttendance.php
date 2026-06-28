<?php

namespace App\Actions\Attendance;

use App\Models\Attendance;
use App\Models\EmployeeShift;
use App\Models\User;
use App\Support\Geofence;
use Illuminate\Support\Carbon;

final class CheckInEmployeeAttendance
{
    public function __construct(
        private readonly ResolveAttendanceIdentity $identity,
        private readonly Geofence $geofence,
        private readonly CreateAttendanceViolation $violations,
    ) {}

    public function handle(array $data, User $user): Attendance
    {
        $employee = $this->identity->employee($data);
        $checkIn = Carbon::parse($data['check_in_at'] ?? now());
        $date = $checkIn->toDateString();
        $shift = $employee->shift;
        $location = $this->geofence->evaluate($data);
        $lateMinutes = $this->lateMinutes($shift, $checkIn);
        $scheduleStatus = $this->scheduleStatus($shift, $checkIn, $lateMinutes);
        $approvalStatus = $scheduleStatus === 'off_shift' ? 'pending' : 'approved';
        $status = $lateMinutes > 0 ? 'late' : 'present';

        $attendance = Attendance::query()->updateOrCreate(
            [
                'employee_id' => $employee->id,
                'date' => $date,
            ],
            [
                'shift_id' => $shift?->id,
                'check_in' => $checkIn->format('H:i'),
                'check_in_latitude' => $location['latitude'],
                'check_in_longitude' => $location['longitude'],
                'check_in_accuracy_meters' => $location['accuracy_meters'],
                'check_in_distance_meters' => $location['distance_meters'],
                'check_in_location_status' => $location['location_status'],
                'status' => $status,
                'scan_method' => ! empty($data['qr_token']) ? 'qr' : 'manual',
                'schedule_status' => $scheduleStatus,
                'approval_status' => $approvalStatus,
                'late_minutes' => $lateMinutes,
                'notes' => $data['notes'] ?? null,
            ]
        );

        if ($lateMinutes > 0) {
            $this->violations->handle($attendance, 'late', $lateMinutes, 'Late check-in detected.');
        }

        if ($scheduleStatus === 'off_shift') {
            $this->violations->handle($attendance, 'off_shift', null, 'Employee checked in outside the assigned shift.');
        }

        return $attendance->load(['employee.shift', 'shift']);
    }

    private function lateMinutes(?EmployeeShift $shift, Carbon $checkIn): int
    {
        if (! $shift) {
            return 0;
        }

        $start = Carbon::parse($checkIn->toDateString().' '.$shift->starts_at->format('H:i'));
        $allowed = $start->copy()->addMinutes((int) $shift->grace_minutes);

        return $checkIn->greaterThan($allowed) ? (int) $allowed->diffInMinutes($checkIn) : 0;
    }

    private function scheduleStatus(?EmployeeShift $shift, Carbon $checkIn, int $lateMinutes): string
    {
        if (! $shift) {
            return 'unassigned';
        }

        $start = Carbon::parse($checkIn->toDateString().' '.$shift->starts_at->format('H:i'));
        $end = Carbon::parse($checkIn->toDateString().' '.$shift->ends_at->format('H:i'));
        if ($end->lessThanOrEqualTo($start)) {
            $end->addDay();
        }

        $windowStart = $start->copy()->subHours(2);
        $windowEnd = $end->copy()->addHours(2);

        if ($checkIn->lessThan($windowStart) || $checkIn->greaterThan($windowEnd)) {
            return 'off_shift';
        }

        return $lateMinutes > 0 ? 'late' : 'on_shift';
    }
}
