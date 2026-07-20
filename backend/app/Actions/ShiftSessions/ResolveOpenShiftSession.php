<?php

namespace App\Actions\ShiftSessions;

use App\Models\EmployeeShift;
use App\Models\ShiftSession;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

class ResolveOpenShiftSession
{
    public function current(?Carbon $at = null): ?ShiftSession
    {
        $at ??= now();

        $open = ShiftSession::query()
            ->with('shift')
            ->where('status', ShiftSession::STATUS_OPEN)
            ->orderByDesc('opened_at')
            ->get();

        if ($open->isEmpty()) {
            return null;
        }

        if ($open->count() === 1) {
            return $open->first();
        }

        $shift = $this->shiftForTime($at, EmployeeShift::query()->where('is_active', true)->get());

        if (! $shift) {
            return $open->first();
        }

        return $open->firstWhere('employee_shift_id', $shift->id) ?? $open->first();
    }

    /**
     * @param  Collection<int, EmployeeShift>  $shifts
     */
    public function shiftForTime(Carbon $at, $shifts): ?EmployeeShift
    {
        $time = $at->format('H:i:s');

        foreach ($shifts as $shift) {
            $start = $shift->starts_at?->format('H:i:s');
            $end = $shift->ends_at?->format('H:i:s');

            if (! $start || ! $end) {
                continue;
            }

            if ($start <= $end) {
                if ($time >= $start && $time <= $end) {
                    return $shift;
                }
            } elseif ($time >= $start || $time <= $end) {
                // Overnight window
                return $shift;
            }
        }

        return null;
    }
}
