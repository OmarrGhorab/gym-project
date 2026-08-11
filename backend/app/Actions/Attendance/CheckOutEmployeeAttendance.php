<?php

namespace App\Actions\Attendance;

use App\Models\Attendance;
use App\Models\Employee;
use App\Models\User;
use App\Services\OperationalNotifier;
use App\Support\Geofence;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;

/**
 * Records the moment an employee left. Shifts carry no end time, so leaving is
 * never early — it is simply when the day ended for them.
 */
final class CheckOutEmployeeAttendance
{
    public function __construct(
        private readonly ResolveAttendanceIdentity $identity,
        private readonly Geofence $geofence,
        private readonly OperationalNotifier $notifier,
    ) {}

    public function handle(array $data, User $user): Attendance
    {
        $employee = $this->identity->employee($data);
        $checkOut = $this->scanTimestamp($data, 'check_out_at');
        $attendance = Attendance::query()
            ->where('employee_id', $employee->id)
            ->where('date', $checkOut->toDateString())
            ->first();

        if (! $attendance) {
            throw ValidationException::withMessages([
                'employee_id' => 'No attendance check-in found for this employee today.',
            ]);
        }

        $this->apply($attendance, $checkOut, $this->geofence->evaluate($data), $data['notes'] ?? null);
        $attendance->load(['employee.shift', 'shift']);

        $this->notifier->employeeCheckedOut(
            $employee,
            $attendance->date?->toDateString() ?? $checkOut->toDateString(),
            $attendance->check_out?->format('H:i'),
            $attendance->shift?->name,
        );

        $this->log($attendance, $user);

        return $attendance;
    }

    /**
     * Close out an employee's day without a scan.
     *
     * Used when the desk session they were holding is handed over: ending the
     * shift ends their day too. Silently does nothing when they never checked
     * in or already checked out, so closing a drawer can never fail on this.
     */
    public function closeOut(Employee $employee, Carbon $checkOut, User $user): ?Attendance
    {
        $attendance = Attendance::query()
            ->where('employee_id', $employee->id)
            ->where('date', $checkOut->toDateString())
            ->first();

        if (! $attendance || $attendance->check_in === null || $attendance->check_out !== null) {
            return null;
        }

        $this->apply($attendance, $checkOut, $this->geofence->evaluate([]), null);
        $attendance->load(['employee.shift', 'shift']);

        $this->notifier->employeeCheckedOut(
            $employee,
            $attendance->date?->toDateString() ?? $checkOut->toDateString(),
            $attendance->check_out?->format('H:i'),
            $attendance->shift?->name,
        );

        $this->log($attendance, $user);

        return $attendance;
    }

    /**
     * @param  array<string, mixed>  $location
     */
    private function apply(Attendance $attendance, Carbon $checkOut, array $location, ?string $notes): void
    {
        $attendance->update([
            'check_out' => $checkOut->format('H:i'),
            'check_out_latitude' => $location['latitude'],
            'check_out_longitude' => $location['longitude'],
            'check_out_accuracy_meters' => $location['accuracy_meters'],
            'check_out_distance_meters' => $location['distance_meters'],
            'check_out_location_status' => $location['location_status'],
            'notes' => $notes ?? $attendance->notes,
        ]);
    }

    private function log(Attendance $attendance, User $user): void
    {
        activity('attendance')
            ->causedBy($user)
            ->performedOn($attendance)
            ->event('check_out')
            ->withProperties([
                'employee_id' => $attendance->employee_id,
                'employee_name' => $attendance->employee?->name,
                'shift' => $attendance->shift?->name,
                'date' => $attendance->date?->toDateString(),
                'check_out' => $attendance->check_out?->format('H:i'),
            ])
            ->log($attendance->employee?->name.' checked out at '.$attendance->check_out?->format('H:i'));
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
