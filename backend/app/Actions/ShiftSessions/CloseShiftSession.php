<?php

namespace App\Actions\ShiftSessions;

use App\Models\Employee;
use App\Models\ShiftSession;
use App\Models\User;
use App\Support\FoundationPermissions;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CloseShiftSession
{
    public function __construct(
        private readonly ComputeShiftSessionTotals $totals,
    ) {}

    public function handle(ShiftSession $session, User $user): ShiftSession
    {
        return DB::transaction(function () use ($session, $user): ShiftSession {
            $locked = ShiftSession::query()->lockForUpdate()->with(['shift'])->findOrFail($session->id);

            if ($locked->status !== ShiftSession::STATUS_OPEN) {
                throw ValidationException::withMessages([
                    'session' => 'Only open sessions can be closed.',
                ]);
            }

            $isAdmin = method_exists($user, 'hasRole') && $user->hasRole(FoundationPermissions::ROLE_ADMIN);

            // Rule 1: Only assigned shift staff (or opener/admin) can close this session
            $employee = Employee::where('user_id', $user->id)->first();
            $isAssignedStaff = ($employee && $employee->shift_id === $locked->employee_shift_id)
                || $locked->opened_by === $user->id;

            if (! $isAdmin && ! $isAssignedStaff) {
                throw ValidationException::withMessages([
                    'session' => 'Only staff members assigned to this shift can close this session.',
                ]);
            }

            // Rule 2: Cannot close before the scheduled shift end time
            $shift = $locked->shift;
            if ($shift && $shift->ends_at) {
                $endTimeStr = $shift->ends_at instanceof \DateTimeInterface
                    ? $shift->ends_at->format('H:i:s')
                    : Carbon::parse($shift->ends_at)->format('H:i:s');

                $startTimeStr = $shift->starts_at instanceof \DateTimeInterface
                    ? $shift->starts_at->format('H:i:s')
                    : ($shift->starts_at ? Carbon::parse($shift->starts_at)->format('H:i:s') : null);

                $businessDate = $locked->business_date
                    ? Carbon::parse($locked->business_date)->toDateString()
                    : now()->toDateString();

                $shiftEndTime = Carbon::parse("{$businessDate} {$endTimeStr}");

                if ($startTimeStr && $endTimeStr < $startTimeStr) {
                    // Overnight shift (e.g. 22:00 to 06:00)
                    $shiftEndTime->addDay();
                }

                if (now()->lessThan($shiftEndTime) && ! $isAdmin) {
                    $formattedTime = $shiftEndTime->format('g:i A');
                    throw ValidationException::withMessages([
                        'session' => "Shift cannot be closed before its scheduled end time ({$formattedTime}).",
                    ]);
                }
            }

            // Recompute + claim orphans so expected totals match every payment/expense in the window.
            $totals = $this->totals->handle($locked);

            $locked->update([
                'closed_at' => now(),
                'closed_by' => $user->id,
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

            return $locked->fresh(['shift', 'openedBy', 'closedBy']);
        });
    }
}
