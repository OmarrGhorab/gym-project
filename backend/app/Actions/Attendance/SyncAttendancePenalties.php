<?php

namespace App\Actions\Attendance;

use App\Models\Attendance;
use App\Models\AttendanceViolation;

/**
 * Keep an attendance record's warnings in step with its clock times.
 *
 * A badge scan raises warnings automatically. Manual entry cannot: an admin is
 * just as likely to be fixing a broken scanner or a typo as recording a genuine
 * late arrival, so they say per entry whether the penalty applies.
 *
 * Passing false — or correcting the times so no minutes are owed — retires any
 * warning the record already carries, which is how a wrongly penalised employee
 * gets made whole.
 */
final class SyncAttendancePenalties
{
    /** Statuses that still count against an employee and can therefore be retired. */
    private const LIVE_STATUSES = ['warning', 'pending', 'approved', 'auto_applied'];

    public function __construct(
        private readonly CreateAttendanceViolation $violations,
    ) {}

    public function handle(Attendance $attendance, bool $applyPenalty): void
    {
        $this->sync(
            $attendance,
            'late',
            (int) $attendance->late_minutes,
            $applyPenalty,
            'Late arrival recorded manually by an admin.',
        );

        $this->sync(
            $attendance,
            'early_leave',
            (int) $attendance->early_leave_minutes,
            $applyPenalty,
            'Early leave recorded manually by an admin.',
        );
    }

    private function sync(Attendance $attendance, string $type, int $minutes, bool $applyPenalty, string $notes): void
    {
        if ($applyPenalty && $minutes > 0) {
            $this->violations->handle($attendance, $type, $minutes, $notes);

            return;
        }

        AttendanceViolation::query()
            ->where('attendance_id', $attendance->id)
            ->where('type', $type)
            ->whereIn('status', self::LIVE_STATUSES)
            ->update(['status' => 'dismissed']);
    }
}
