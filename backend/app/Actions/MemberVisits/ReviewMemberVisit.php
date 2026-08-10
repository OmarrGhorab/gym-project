<?php

namespace App\Actions\MemberVisits;

use App\Models\MemberVisit;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Settle a scan the desk was asked to judge.
 *
 * A second scan for a member who is already inside is held rather than guessed
 * at: it is either the badge being read twice, or the member genuinely leaving
 * and coming back. Only this decision moves money — the first visit keeps its
 * session either way.
 */
class ReviewMemberVisit
{
    public function __construct(private readonly ResolveMemberVisitSubscription $subscriptions) {}

    public function handle(MemberVisit $visit, string $decision, User $user): MemberVisit
    {
        return DB::transaction(function () use ($visit, $decision, $user): MemberVisit {
            $locked = MemberVisit::query()->lockForUpdate()->findOrFail($visit->id);

            if ($locked->status !== 'pending_review') {
                throw ValidationException::withMessages([
                    'decision' => 'This visit is not pending review.',
                ]);
            }

            return $decision === 'approved'
                ? $this->approve($locked, $user)
                : $this->dismiss($locked, $user);
        });
    }

    /** The member really came back: close the visit they were still on, and charge this one. */
    private function approve(MemberVisit $visit, User $user): MemberVisit
    {
        // Only a visit that actually counts may be closed here. Grabbing "the latest
        // open visit" also caught other scans still awaiting a decision, closing them
        // while leaving them pending — a row the desk could never resolve.
        $previous = MemberVisit::query()
            ->where('member_id', $visit->member_id)
            ->where('id', '!=', $visit->id)
            ->whereIn('status', ['allowed', 'flagged'])
            ->whereNull('check_out_at')
            ->latest('check_in_at')
            ->first();

        $previous?->update(['check_out_at' => $visit->check_in_at]);

        $subscription = $this->subscriptions->consume($visit->member, $visit->check_in_at);
        $addon = $visit->subscription_addon_id
            ? $this->subscriptions->consumeAddon($visit->member, $visit->check_in_at, $visit->subscription_addon_id)
            : $this->subscriptions->autoConsumeActiveAddon($visit->member, $visit->check_in_at, $subscription);

        $visit->update([
            'subscription_id' => $subscription->id,
            'subscription_addon_id' => $addon?->id,
            'status' => 'allowed',
            'reviewed_by' => $user->id,
            'reviewed_at' => now(),
            'alert_reason' => null,
        ]);

        return $visit;
    }

    /**
     * The badge was scanned twice. The duplicate is closed out and never counts,
     * and the visit the member is actually on is deliberately left untouched.
     */
    private function dismiss(MemberVisit $visit, User $user): MemberVisit
    {
        $visit->update([
            'status' => 'blocked',
            'check_out_at' => $visit->check_in_at,
            'reviewed_by' => $user->id,
            'reviewed_at' => now(),
            'alert_reason' => 'Dismissed as a duplicate scan.',
        ]);

        return $visit;
    }
}
