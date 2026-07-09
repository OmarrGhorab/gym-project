<?php

namespace App\Actions\Attendance;

use App\Actions\Payroll\ApplyAttendanceBonuses;
use App\Models\Attendance;
use App\Models\EmployeeShift;
use App\Models\Payroll;
use App\Models\User;
use App\Services\OperationalNotifier;
use App\Support\Geofence;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;

final class CheckInEmployeeAttendance
{
    public function __construct(
        private readonly ResolveAttendanceIdentity $identity,
        private readonly Geofence $geofence,
        private readonly CreateAttendanceViolation $violations,
        private readonly ApplyAttendanceBonuses $attendanceBonuses,
        private readonly OperationalNotifier $notifier,
    ) {}

    public function handle(array $data, User $user): Attendance
    {
        $employee = $this->identity->employee($data);
        $checkIn = $this->scanTimestamp($data, 'check_in_at');
        $date = $checkIn->toDateString();
        $shift = $employee->shift;
        $location = $this->geofence->evaluate($data);
        $isOffDay = $this->isOffDay($shift, $checkIn);
        $lateMinutes = $isOffDay ? 0 : $this->lateMinutes($shift, $checkIn);
        $scheduleStatus = $this->scheduleStatus($shift, $checkIn, $lateMinutes);
        $approvalStatus = $scheduleStatus === 'off_shift' ? 'pending' : 'approved';
        $status = $lateMinutes > 0 ? 'late' : 'present';
        $offDayBonusAmount = $isOffDay && $shift?->off_day_bonus_enabled ? (string) $shift->off_day_bonus_amount : '0.00';
        $existingAttendance = Attendance::query()
            ->where('employee_id', $employee->id)
            ->whereDate('date', $date)
            ->first();

        if ($existingAttendance?->check_in !== null) {
            throw ValidationException::withMessages([
                'employee_id' => 'This employee already checked in today. Check them out or correct the existing attendance record.',
            ]);
        }

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
                'off_day_bonus_amount' => $offDayBonusAmount,
                'notes' => $data['notes'] ?? null,
            ]
        );

        if ($lateMinutes > 0) {
            $this->violations->handle($attendance, 'late', $lateMinutes, 'Late check-in detected.');
        }

        if ($scheduleStatus === 'off_shift') {
            $this->violations->handle($attendance, 'off_shift', null, 'Employee checked in outside the assigned shift.');
        }

        $this->syncPendingPayrollBonus($attendance);
        $attendance->load(['employee.shift', 'shift']);
        if ($scheduleStatus === 'off_shift') {
            $this->notifier->offShiftAttendance(
                $employee,
                $attendance->date?->toDateString() ?? $date,
                $attendance->check_in?->format('H:i'),
                $attendance->shift?->name,
            );

            activity('attendance')
                ->causedBy($user)
                ->performedOn($attendance)
                ->event('off_shift')
                ->withProperties([
                    'employee_id' => $attendance->employee_id,
                    'employee_name' => $attendance->employee?->name,
                    'shift' => $attendance->shift?->name,
                    'date' => $attendance->date?->toDateString(),
                    'check_in' => $attendance->check_in?->format('H:i'),
                    'status' => $attendance->status,
                    'schedule_status' => $attendance->schedule_status,
                    'approval_status' => $attendance->approval_status,
                ])
                ->log(($attendance->employee?->name ?? 'Employee').' checked in outside the assigned shift.');
        }

        activity('attendance')
            ->causedBy($user)
            ->performedOn($attendance)
            ->event('check_in')
            ->withProperties([
                'employee_id' => $attendance->employee_id,
                'employee_name' => $attendance->employee?->name,
                'shift' => $attendance->shift?->name,
                'date' => $attendance->date?->toDateString(),
                'check_in' => $attendance->check_in?->format('H:i'),
                'status' => $attendance->status,
                'schedule_status' => $attendance->schedule_status,
            ])
            ->log($attendance->employee?->name.' checked in for '.$attendance->shift?->name.' at '.$attendance->check_in?->format('H:i'));

        return $attendance;
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

        if ($this->isOffDay($shift, $checkIn)) {
            return 'off_day';
        }

        $start = Carbon::parse($checkIn->toDateString().' '.$shift->starts_at->format('H:i'));
        $end = Carbon::parse($checkIn->toDateString().' '.$shift->ends_at->format('H:i'));
        if ($end->lessThanOrEqualTo($start)) {
            $end->addDay();
        }

        $graceMinutes = (int) $shift->grace_minutes;
        $windowStart = $start->copy()->subMinutes($graceMinutes);
        $windowEnd = $end->copy()->addMinutes($graceMinutes);

        if ($checkIn->lessThan($windowStart) || $checkIn->greaterThan($windowEnd)) {
            return 'off_shift';
        }

        return $lateMinutes > 0 ? 'late' : 'on_shift';
    }

    private function isOffDay(?EmployeeShift $shift, Carbon $date): bool
    {
        if (! $shift || empty($shift->off_days)) {
            return false;
        }

        return in_array((int) $date->dayOfWeek, array_map('intval', $shift->off_days), true);
    }

    private function scanTimestamp(array $data, string $field): Carbon
    {
        if (! empty($data[$field])) {
            return Carbon::parse($data[$field]);
        }

        if (! empty($data['attendance_date'])) {
            return Carbon::parse($data['attendance_date'])->setTimeFrom(now());
        }

        return now();
    }

    private function syncPendingPayrollBonus(Attendance $attendance): void
    {
        if (bccomp((string) $attendance->off_day_bonus_amount, '0.00', 2) !== 1) {
            return;
        }

        $month = Carbon::parse($attendance->date)->format('Y-m');
        $payroll = Payroll::query()
            ->where('employee_id', $attendance->employee_id)
            ->where('month', $month)
            ->where('status', 'pending')
            ->first();

        if (! $payroll) {
            return;
        }

        $this->attendanceBonuses->execute($payroll);
    }
}
