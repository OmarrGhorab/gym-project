<?php

namespace App\Actions\Overtime;

use App\Models\Attendance;
use App\Models\Employee;
use App\Models\EmployeeShift;
use App\Models\OvertimeShift;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class StoreOvertimeShift
{
    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(array $data, User $user): OvertimeShift
    {
        return DB::transaction(function () use ($data, $user): OvertimeShift {
            $employee = Employee::query()->findOrFail($data['employee_id']);
            $date = Carbon::parse($data['date'])->startOfDay();
            $coveringFor = isset($data['covering_for_employee_id'])
                ? Employee::query()->find($data['covering_for_employee_id'])
                : null;

            if ($coveringFor && (int) $coveringFor->id === (int) $employee->id) {
                throw ValidationException::withMessages([
                    'covering_for_employee_id' => 'An employee cannot cover their own shift.',
                ]);
            }

            $isDeskReplacement = str_starts_with((string) ($data['notes'] ?? ''), 'Shift Desk replacement.');

            if ($coveringFor && $this->hasCheckedIn($coveringFor, $date) && ! $isDeskReplacement) {
                throw ValidationException::withMessages([
                    'covering_for_employee_id' => 'This employee already attended on '.$date->toDateString().', so their shift does not need cover.',
                ]);
            }

            $shift = $this->resolveShift($data, $employee, $coveringFor);

            $duplicate = OvertimeShift::query()
                ->activeClaim()
                ->where('employee_id', $employee->id)
                ->whereDate('date', $date->toDateString())
                ->where('employee_shift_id', $shift?->id)
                ->exists();

            if ($duplicate) {
                throw ValidationException::withMessages([
                    'employee_id' => 'This employee already has an overtime shift recorded for that day and shift.',
                ]);
            }

            if ($coveringFor) {
                $alreadyCovered = OvertimeShift::query()
                    ->activeClaim()
                    ->where('covering_for_employee_id', $coveringFor->id)
                    ->whereDate('date', $date->toDateString())
                    ->exists();

                if ($alreadyCovered) {
                    throw ValidationException::withMessages([
                        'covering_for_employee_id' => 'Another employee is already covering this shift.',
                    ]);
                }
            }

            $isDeskReplacement = str_starts_with((string) ($data['notes'] ?? ''), 'Shift Desk replacement.');
            $startsAt = $isDeskReplacement
                ? now()->format('H:i')
                : ($this->time($data['starts_at'] ?? null) ?? $shift?->starts_at?->format('H:i'));
            $endsAt = $isDeskReplacement
                ? null
                : ($this->time($data['ends_at'] ?? null) ?? $shift?->ends_at?->format('H:i'));

            $overtime = OvertimeShift::query()->create([
                'employee_id' => $employee->id,
                'covering_for_employee_id' => $coveringFor?->id,
                'employee_shift_id' => $shift?->id,
                'date' => $date->toDateString(),
                'starts_at' => $startsAt,
                'ends_at' => $endsAt,
                'hours' => $isDeskReplacement ? null : $this->hours($data, $startsAt, $endsAt),
                // A proposed amount is stored while pending; payroll only reads approved rows.
                'bonus_amount' => $data['bonus_amount'] ?? '0.00',
                'status' => OvertimeShift::STATUS_PENDING,
                'notes' => $data['notes'] ?? null,
                'created_by' => $user->id,
            ]);

            $overtime->load(['employee', 'coveringFor', 'shift']);

            activity('overtime_shifts')
                ->causedBy($user)
                ->performedOn($overtime)
                ->event('created')
                ->withProperties([
                    'employee_id' => $overtime->employee_id,
                    'employee_name' => $overtime->employee?->name,
                    'covering_for_employee_id' => $overtime->covering_for_employee_id,
                    'covering_for_name' => $overtime->coveringFor?->name,
                    'shift' => $overtime->shift?->name,
                    'date' => $overtime->date?->toDateString(),
                    'hours' => $overtime->hours,
                ])
                ->log(($overtime->employee?->name ?? 'Employee').' picked up an overtime shift on '.$date->toDateString());

            return $overtime;
        });
    }

    private function hasCheckedIn(Employee $employee, Carbon $date): bool
    {
        return Attendance::query()
            ->where('employee_id', $employee->id)
            ->whereDate('date', $date->toDateString())
            ->whereNotNull('check_in')
            ->exists();
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function resolveShift(array $data, Employee $employee, ?Employee $coveringFor): ?EmployeeShift
    {
        if (! empty($data['employee_shift_id'])) {
            return EmployeeShift::query()->find($data['employee_shift_id']);
        }

        $shiftId = $coveringFor?->shift_id ?? $employee->shift_id;

        return $shiftId ? EmployeeShift::query()->find($shiftId) : null;
    }

    private function time(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        return Carbon::parse((string) $value)->format('H:i');
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function hours(array $data, ?string $startsAt, ?string $endsAt): ?string
    {
        if (isset($data['hours']) && $data['hours'] !== '') {
            return number_format((float) $data['hours'], 2, '.', '');
        }

        if (! $startsAt || ! $endsAt) {
            return null;
        }

        $start = Carbon::parse($startsAt);
        $end = Carbon::parse($endsAt);

        if ($end->lessThanOrEqualTo($start)) {
            // Overnight shift (e.g. 22:00 to 06:00).
            $end->addDay();
        }

        return number_format($start->diffInMinutes($end) / 60, 2, '.', '');
    }
}
