<?php

namespace App\Actions\Attendance;

use App\Models\Attendance;
use App\Models\ShiftSession;
use App\Models\User;
use App\Services\OperationalNotifier;
use App\Support\Geofence;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;

/**
 * Records the moment an employee arrived — nothing more.
 *
 * Shifts carry no times, so there is no such thing as arriving late here. The
 * shift stored on the record is only the block of the day they worked, taken
 * from the desk session that is open when they scan.
 */
final class CheckInEmployeeAttendance
{
    public function __construct(
        private readonly ResolveAttendanceIdentity $identity,
        private readonly Geofence $geofence,
        private readonly OperationalNotifier $notifier,
    ) {}

    public function handle(array $data, User $user): Attendance
    {
        $employee = $this->identity->employee($data);
        $checkIn = $this->scanTimestamp($data, 'check_in_at');
        $date = $checkIn->toDateString();
        $shift = $this->attendanceShift($employee->id, $employee->shift_id, $date);
        $location = $this->geofence->evaluate($data);
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
                'shift_id' => $shift,
                'check_in' => $checkIn->format('H:i'),
                'check_in_latitude' => $location['latitude'],
                'check_in_longitude' => $location['longitude'],
                'check_in_accuracy_meters' => $location['accuracy_meters'],
                'check_in_distance_meters' => $location['distance_meters'],
                'check_in_location_status' => $location['location_status'],
                'status' => 'present',
                'scan_method' => $this->resolveScanMethod($data),
                'notes' => $data['notes'] ?? null,
            ]
        );

        $attendance->load(['employee.shift', 'shift']);

        $this->notifier->employeeCheckedIn(
            $employee,
            $attendance->date?->toDateString() ?? $date,
            $attendance->check_in?->format('H:i'),
            $attendance->shift?->name,
        );

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
            ])
            ->log($attendance->employee?->name.' checked in at '.$attendance->check_in?->format('H:i'));

        return $attendance;
    }

    /**
     * The open desk session names the block of the day being worked. Falling
     * back to the employee's own shift keeps a scan meaningful when nobody has
     * opened a drawer yet.
     */
    private function attendanceShift(int $employeeId, ?int $homeShiftId, string $date): ?int
    {
        $session = ShiftSession::query()
            ->where('status', ShiftSession::STATUS_OPEN)
            ->whereDate('business_date', $date)
            ->where(function ($query) use ($employeeId): void {
                $query->where('opened_by_employee_id', $employeeId)
                    ->orWhereNull('opened_by_employee_id');
            })
            ->orderByRaw('opened_by_employee_id is null')
            ->latest('opened_at')
            ->first();

        return $session?->employee_shift_id ?? $homeShiftId;
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function resolveScanMethod(array $data): string
    {
        $requested = strtolower(trim((string) ($data['scan_method'] ?? '')));

        if (in_array($requested, ['qr', 'scanner', 'manual'], true)) {
            return $requested;
        }

        return ! empty($data['qr_token']) ? 'qr' : 'manual';
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
}
