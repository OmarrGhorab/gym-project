<?php

namespace App\Actions\ShiftSessions;

use App\Models\ShiftSession;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Hand an open session's drawer to a different employee of the same shift.
 *
 * Used when the desk changes hands mid-shift, or to correct a session that was
 * opened before the responsible employee was recorded. The money and totals are
 * untouched — only who is accountable for them changes.
 */
class AssignShiftStaff
{
    public function __construct(
        private readonly ResolveShiftStaff $staff,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(ShiftSession $session, array $data, User $user): ShiftSession
    {
        return DB::transaction(function () use ($session, $data, $user): ShiftSession {
            $locked = ShiftSession::query()
                ->lockForUpdate()
                ->with(['shift', 'openedByEmployee'])
                ->findOrFail($session->id);

            if ($locked->status !== ShiftSession::STATUS_OPEN) {
                throw ValidationException::withMessages([
                    'session' => 'Only an open session can change its staff on duty.',
                ]);
            }

            $previous = $locked->openedByEmployee?->name;

            // Same rule as opening: the employee must belong to this shift or be its
            // approved cover on this business date; only an admin may nominate another person.
            $employee = $this->staff->handle($locked->shift, $user, $data['employee_id'] ?? null, 'employee_id', $locked->business_date);

            $locked->update(['opened_by_employee_id' => $employee->id]);

            $fresh = $locked->fresh(['shift', 'openedBy', 'openedByEmployee']);

            activity('shift_sessions')
                ->causedBy($user)
                ->performedOn($fresh)
                ->event('staff_assigned')
                ->withProperties([
                    'shift_session_id' => $fresh->id,
                    'shift' => $fresh->shift?->name,
                    'previous_staff' => $previous,
                    'staff_on_duty' => $employee->name,
                ])
                ->log('Shift session #'.$fresh->id.' handed to '.$employee->name);

            return $fresh;
        });
    }
}
