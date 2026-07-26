<?php

namespace App\Actions\ShiftSessions;

use App\Models\ShiftSession;
use App\Models\User;
use App\Services\OperationalNotifier;
use App\Support\FoundationPermissions;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CloseShiftSession
{
    public function __construct(
        private readonly ComputeShiftSessionTotals $totals,
        private readonly ResolveShiftStaff $staff,
        private readonly OperationalNotifier $notifier,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(ShiftSession $session, User $user, array $data = []): ShiftSession
    {
        $closed = DB::transaction(function () use ($session, $user, $data): ShiftSession {
            $locked = ShiftSession::query()->lockForUpdate()->with(['shift'])->findOrFail($session->id);

            if ($locked->status !== ShiftSession::STATUS_OPEN) {
                throw ValidationException::withMessages([
                    'session' => 'Only open sessions can be closed.',
                ]);
            }

            $isAdmin = method_exists($user, 'hasRole') && $user->hasRole(FoundationPermissions::ROLE_ADMIN);
            $employeeId = $data['employee_id'] ?? null;

            // An admin closing without naming anyone closes on behalf of the employee who opened it.
            if ($employeeId === null && $isAdmin && $locked->opened_by_employee_id) {
                $employeeId = $locked->opened_by_employee_id;
            }

            // Only an employee of this shift may close its drawer.
            $employee = $this->staff->handle($locked->shift, $user, $employeeId);

            // The scheduled end time is not a gate: staff close the session by hand when they
            // actually check out, which may be earlier or later than the schedule on an
            // overtime shift.

            // Recompute + claim orphans so expected totals match every payment/expense in the window.
            $totals = $this->totals->handle($locked);

            $locked->update([
                'closed_at' => now(),
                'closed_by' => $user->id,
                'closed_by_employee_id' => $employee->id,
                'status' => ShiftSession::STATUS_PENDING_HANDOVER,
                // Expected = system money (cash includes opening float).
                'expected_cash' => $totals['cash'],
                'expected_card' => $totals['card'],
                'expected_bank' => $totals['bank'],
                'expected_expenses' => $totals['expenses'],
                'expected_net' => $totals['net'],
                // Pre-fill counted with expected so staff only edits what differs.
                'counted_cash' => $totals['cash'],
                'counted_card' => $totals['card'],
                'counted_bank' => $totals['bank'],
                'counted_expenses' => $totals['expenses'],
            ]);

            return $locked->fresh(['shift', 'openedBy', 'closedBy', 'openedByEmployee', 'closedByEmployee']);
        });

        $this->notifier->shiftSessionClosed($closed);

        return $closed;
    }
}
