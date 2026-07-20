<?php

namespace App\Actions\ShiftSessions;

use App\Models\ShiftSession;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ReviewShiftHandover
{
    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(ShiftSession $session, array $data, User $user): ShiftSession
    {
        return DB::transaction(function () use ($session, $data, $user): ShiftSession {
            $locked = ShiftSession::query()->lockForUpdate()->findOrFail($session->id);

            if ($locked->status !== ShiftSession::STATUS_PENDING_ADMIN) {
                throw ValidationException::withMessages([
                    'session' => 'This session is not pending admin review.',
                ]);
            }

            $decision = (string) ($data['decision'] ?? '');
            if (! in_array($decision, ['accepted', 'rejected'], true)) {
                throw ValidationException::withMessages([
                    'decision' => 'Decision must be accepted or rejected.',
                ]);
            }

            $locked->update([
                'status' => $decision === 'accepted' ? ShiftSession::STATUS_ACCEPTED : ShiftSession::STATUS_DISPUTED,
                'admin_decision' => $decision,
                'admin_reviewed_by' => $user->id,
                'admin_reviewed_at' => now(),
                'variance_notes' => $data['notes'] ?? $locked->variance_notes,
            ]);

            return $locked->fresh(['shift', 'openedBy', 'closedBy', 'receivedBy', 'adminReviewer']);
        });
    }
}
