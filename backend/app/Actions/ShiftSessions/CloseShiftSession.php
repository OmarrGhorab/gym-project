<?php

namespace App\Actions\ShiftSessions;

use App\Models\Employee;
use App\Models\Setting;
use App\Models\ShiftSession;
use App\Models\User;
use App\Actions\Attendance\CheckOutEmployeeAttendance;
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
        private readonly CheckOutEmployeeAttendance $checkOut,
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

            if ($employeeId === null && $locked->opened_by_employee_id) {
                $actorEmployeeId = Employee::query()->where('user_id', $user->id)->value('id');
                if ((int) $actorEmployeeId === (int) $locked->opened_by_employee_id) {
                    $employeeId = (int) $actorEmployeeId;
                }
            }

            $employee = $this->staff->handle(
                $locked->shift,
                $user,
                $employeeId,
                'employee_id',
                $employeeId !== null && (int) $employeeId === (int) $locked->opened_by_employee_id,
            );

            // Recompute + claim orphans so expected totals match every payment/expense in the window.
            $totals = $this->totals->handle($locked);

            // Without the cash count, closing a shift means the shift is closed.
            // Leaving it in pending_handover turned one action into a three-step
            // chore — count, submit, wait for a manager — for a desk that is meant
            // to be driven by hand.
            $requireCount = (bool) $this->requireCashCount();

            $locked->update([
                'closed_at' => now(),
                'closed_by' => $user->id,
                'closed_by_employee_id' => $employee->id,
                'status' => $requireCount
                    ? ShiftSession::STATUS_PENDING_HANDOVER
                    : ShiftSession::STATUS_AUTO_ACCEPTED,
                // Expected = system money (cash includes opening float).
                'expected_cash' => $totals['cash'],
                'expected_card' => $totals['card'],
                'expected_bank' => $totals['bank'],
                'expected_expenses' => $totals['expenses'],
                'expected_net' => $totals['net'],
                // Pre-fill counted with expected so staff only edits what differs.
                // With counting off these are simply what the system recorded.
                'counted_cash' => $totals['cash'],
                'counted_card' => $totals['card'],
                'counted_bank' => $totals['bank'],
                'counted_expenses' => $totals['expenses'],
                // auto_accepted already means "closed without a human reviewing it",
                // which is exactly true here — so history and reports need no new state.
                'admin_decision' => $requireCount ? null : 'accepted',
                'admin_reviewed_at' => $requireCount ? null : now(),
            ]);

            return $locked->fresh(['shift', 'openedBy', 'closedBy', 'openedByEmployee', 'closedByEmployee']);
        });

        // Ending the shift ends the day for whoever was holding it. A no-op when
        // they never scanned in or already scanned out.
        if ($closed->closedByEmployee) {
            $this->checkOut->closeOut($closed->closedByEmployee, now(), $user);
        }

        $this->notifier->shiftSessionClosed($closed);

        return $closed;
    }

    /** Off by default: the drawer count is a control the gym opts into, not a step it inherits. */
    private function requireCashCount(): bool
    {
        $value = Setting::query()->where('key', 'shifts.require_cash_count')->first()?->value;

        return $value === null ? false : filter_var($value, FILTER_VALIDATE_BOOLEAN);
    }
}
