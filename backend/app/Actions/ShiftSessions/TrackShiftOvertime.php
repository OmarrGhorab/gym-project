<?php

namespace App\Actions\ShiftSessions;

use App\Models\EmployeeShift;
use App\Models\OvertimeShift;
use App\Models\ShiftSession;
use App\Models\User;
use Illuminate\Support\Carbon;

/** Keeps handover overtime open until the employee actually leaves the desk. */
class TrackShiftOvertime
{
    public function begin(ShiftSession $session, int $replacementId, int $coveringForId, User $user, Carbon $at): void
    {
        $this->finish($session, $coveringForId, $at);

        $date = Carbon::parse($session->business_date)->toDateString();
        $exists = OvertimeShift::query()
            ->activeClaim()
            ->where('employee_id', $replacementId)
            ->where('covering_for_employee_id', $coveringForId)
            ->where('employee_shift_id', $session->employee_shift_id)
            ->whereDate('date', $date)
            ->exists();

        if ($exists) {
            return;
        }

        OvertimeShift::query()->create([
            'employee_id' => $replacementId,
            'covering_for_employee_id' => $coveringForId,
            'employee_shift_id' => $session->employee_shift_id,
            'date' => $date,
            'starts_at' => $at->format('H:i'),
            'ends_at' => null,
            'hours' => null,
            'bonus_amount' => '0.00',
            'status' => OvertimeShift::STATUS_PENDING,
            'notes' => 'Shift handover. Bonus pending admin approval.',
            'created_by' => $user->id,
        ]);
    }

    public function finish(ShiftSession $session, int $employeeId, Carbon $at): void
    {
        $date = Carbon::parse($session->business_date)->toDateString();
        $record = OvertimeShift::query()
            ->whereIn('status', [OvertimeShift::STATUS_PENDING, OvertimeShift::STATUS_APPROVED])
            ->where('employee_id', $employeeId)
            ->where('employee_shift_id', $session->employee_shift_id)
            ->whereDate('date', $date)
            ->whereNotNull('covering_for_employee_id')
            ->latest('id')
            ->first();

        if (! $record || ! $record->starts_at) {
            return;
        }

        $start = $this->dateTime($date, $record->starts_at->format('H:i'), $session->shift);
        $end = $at->copy();
        if ($end->lessThanOrEqualTo($start)) {
            $end->addDay();
        }

        $minutes = max(0, $start->diffInMinutes($end));
        $record->update([
            'ends_at' => $at->format('H:i'),
            'hours' => number_format($minutes / 60, 2, '.', ''),
        ]);
    }

    private function dateTime(string $date, string $time, ?EmployeeShift $shift): Carbon
    {
        $start = Carbon::parse($date.' '.$time);
        $shiftStart = $shift?->starts_at?->format('H:i');
        $shiftEnd = $shift?->ends_at?->format('H:i');

        if ($shiftStart && $shiftEnd && $shiftEnd <= $shiftStart && $time < $shiftStart) {
            $start->addDay();
        }

        return $start;
    }
}
