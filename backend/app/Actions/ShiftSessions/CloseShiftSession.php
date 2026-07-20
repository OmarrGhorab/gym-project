<?php

namespace App\Actions\ShiftSessions;

use App\Models\ShiftSession;
use App\Models\User;
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
            $locked = ShiftSession::query()->lockForUpdate()->findOrFail($session->id);

            if ($locked->status !== ShiftSession::STATUS_OPEN) {
                throw ValidationException::withMessages([
                    'session' => 'Only open sessions can be closed.',
                ]);
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
