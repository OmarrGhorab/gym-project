<?php

namespace App\Actions\MemberVisits;

use App\Models\Member;
use Illuminate\Support\Carbon;

/**
 * The membership as the desk needs to read it at the door: which plan, when it
 * runs to, and what is left on it.
 *
 * Used for a refused scan, where there is no visit record to render — the member
 * is turned away, so the reason has to arrive with enough of the membership
 * attached to explain itself.
 */
final class SummarizeMemberMembership
{
    /**
     * @return array<string, mixed>
     */
    public function handle(Member $member, Carbon $asOf): array
    {
        $subscription = $member->latestSubscription()->with('plan')->first();

        return [
            'member' => [
                'id' => $member->id,
                'name' => $member->name,
                'phone' => $member->phone,
                // Counted the same way the day sheet counts it, so a refused scan
                // and the table below it never disagree about the same member.
                'visits_this_month' => $member->visits()
                    ->whereBetween('check_in_at', [
                        $asOf->copy()->startOfMonth()->toDateTimeString(),
                        $asOf->copy()->endOfMonth()->toDateTimeString(),
                    ])
                    ->whereIn('status', ['allowed', 'flagged'])
                    ->count(),
            ],
            'plan_name' => $subscription?->plan?->name,
            'plan_status' => $subscription?->status,
            'plan_start_date' => $subscription?->start_date?->toDateString(),
            'plan_end_date' => $subscription?->end_date?->toDateString(),
            'sessions_remaining' => $subscription?->sessions_remaining,
            'sessions_total' => $subscription?->sessions_total,
        ];
    }
}
