<?php

namespace App\Actions\MemberVisits;

use App\Models\Member;
use App\Models\MemberVisit;
use Illuminate\Validation\ValidationException;

final class EnsureMemberCanCheckIn
{
    public function handle(Member $member): void
    {
        $openVisit = MemberVisit::query()
            ->where('member_id', $member->id)
            ->whereNull('check_out_at')
            ->latest('check_in_at')
            ->first();

        if (! $openVisit) {
            return;
        }

        throw ValidationException::withMessages([
            'member_id' => 'This member already has an open visit. Check them out before checking in again.',
        ]);
    }
}
