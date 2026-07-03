<?php

namespace App\Actions\MemberVisits;

use App\Models\Member;
use App\Models\Subscription;
use Illuminate\Support\Carbon;

final class ResolveMemberVisitSubscription
{
    public function consume(Member $member, Carbon $checkIn): ?Subscription
    {
        $subscription = $member->subscriptions()
            ->with('plan')
            ->where('status', 'active')
            ->whereDate('start_date', '<=', $checkIn->toDateString())
            ->whereDate('end_date', '>=', $checkIn->toDateString())
            ->where(function ($query): void {
                $query->whereNull('sessions_remaining')
                    ->orWhere('sessions_remaining', '>', 0);
            })
            ->latest('end_date')
            ->lockForUpdate()
            ->first();

        if (! $subscription) {
            return null;
        }

        if (! $subscription->plan?->allowsAccessAt($checkIn)) {
            return null;
        }

        if ($subscription->sessions_remaining !== null) {
            $subscription->decrement('sessions_remaining');
            $subscription->refresh();
        }

        return $subscription;
    }

    public function alertReason(Member $member, Carbon $checkIn): string
    {
        $latest = $member->latestSubscription()->with('plan')->first();

        if (! $latest) {
            return 'No subscription found.';
        }

        if ($latest->status !== 'active') {
            return "Subscription is {$latest->status}.";
        }

        if ($latest->end_date?->lt($checkIn)) {
            return 'Subscription is expired.';
        }

        if ($latest->sessions_remaining !== null && $latest->sessions_remaining < 1) {
            return 'Subscription has no sessions remaining.';
        }

        if (! $latest->plan?->allowsAccessAt($checkIn)) {
            return 'Subscription does not allow access at this time.';
        }

        return 'No active subscription covers this visit date.';
    }
}
