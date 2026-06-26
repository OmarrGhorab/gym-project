<?php

namespace App\Actions\MemberVisits;

use App\Models\Member;
use App\Models\MemberVisit;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Support\Carbon;

final class StoreMemberVisit
{
    public function handle(array $data, User $user): MemberVisit
    {
        $checkIn = Carbon::parse($data['check_in_at'] ?? now());
        $member = Member::query()->findOrFail($data['member_id']);
        $subscription = $this->activeSubscription($member, $checkIn);
        $status = $subscription ? 'allowed' : 'blocked';

        $visit = MemberVisit::create([
            'member_id' => $member->id,
            'subscription_id' => $subscription?->id,
            'check_in_at' => $checkIn,
            'check_out_at' => isset($data['check_out_at']) ? Carbon::parse($data['check_out_at']) : null,
            'status' => $status,
            'alert_reason' => $status === 'blocked' ? $this->alertReason($member, $checkIn) : null,
            'notes' => $data['notes'] ?? null,
            'created_by' => $user->id,
        ]);

        return $visit->load(['member.latestSubscription.plan', 'subscription.plan', 'creator']);
    }

    private function activeSubscription(Member $member, Carbon $checkIn): ?Subscription
    {
        return $member->subscriptions()
            ->where('status', 'active')
            ->whereDate('start_date', '<=', $checkIn->toDateString())
            ->whereDate('end_date', '>=', $checkIn->toDateString())
            ->latest('end_date')
            ->first();
    }

    private function alertReason(Member $member, Carbon $checkIn): string
    {
        $latest = $member->latestSubscription;

        if (! $latest) {
            return 'No subscription found.';
        }

        if ($latest->status !== 'active') {
            return "Subscription is {$latest->status}.";
        }

        if ($latest->end_date?->lt($checkIn)) {
            return 'Subscription is expired.';
        }

        return 'No active subscription covers this visit date.';
    }
}
