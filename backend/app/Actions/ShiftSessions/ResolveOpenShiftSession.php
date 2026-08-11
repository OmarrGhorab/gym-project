<?php

namespace App\Actions\ShiftSessions;

use App\Models\ShiftSession;
use Illuminate\Support\Carbon;

class ResolveOpenShiftSession
{
    /**
     * The drawer a sale, payment or expense belongs to.
     *
     * Shifts have no times to match the clock against, so the money goes to the
     * session that was opened most recently — which is the desk actually being
     * worked when more than one is somehow left open.
     */
    public function current(?Carbon $at = null): ?ShiftSession
    {
        return ShiftSession::query()
            ->with('shift')
            ->where('status', ShiftSession::STATUS_OPEN)
            ->orderByDesc('opened_at')
            ->first();
    }
}
