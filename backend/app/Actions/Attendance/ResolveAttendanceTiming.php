<?php

namespace App\Actions\Attendance;

use App\Models\EmployeeShift;
use Illuminate\Support\Carbon;

/**
 * Lateness / early-leave arithmetic against a shift schedule.
 *
 * Shared by the scan stations and by manual entry so an admin correcting a
 * missed scan produces exactly the same numbers the scanner would have.
 */
final class ResolveAttendanceTiming
{
    /** Minutes past the shift start plus its grace period. */
    public function lateMinutes(?EmployeeShift $shift, Carbon $checkIn): int
    {
        if (! $shift?->starts_at) {
            return 0;
        }

        $start = Carbon::parse($checkIn->toDateString().' '.$shift->starts_at->format('H:i'));
        $allowed = $start->copy()->addMinutes((int) $shift->grace_minutes);

        return $checkIn->greaterThan($allowed) ? (int) $allowed->diffInMinutes($checkIn) : 0;
    }

    /** Minutes left before the shift end. Overnight shifts roll the end into the next day. */
    public function earlyLeaveMinutes(?EmployeeShift $shift, Carbon $checkOut): int
    {
        if (! $shift?->starts_at || ! $shift->ends_at) {
            return 0;
        }

        $start = Carbon::parse($checkOut->toDateString().' '.$shift->starts_at->format('H:i'));
        $end = Carbon::parse($checkOut->toDateString().' '.$shift->ends_at->format('H:i'));

        if ($end->lessThanOrEqualTo($start)) {
            $end->addDay();
        }

        return $checkOut->lessThan($end) ? (int) $checkOut->diffInMinutes($end) : 0;
    }

    /**
     * Parse an "H:i" clock time recorded against a business date.
     */
    public function at(string $date, string $clock): Carbon
    {
        return Carbon::parse($date.' '.$clock);
    }
}
