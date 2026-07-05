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
            ->where(function ($query): void {
                $query->whereNull('sessions_remaining')
                    ->orWhere('sessions_remaining', '>', 0);
            })
            ->latest('end_date')
            ->lockForUpdate()
            ->get()
            ->first(fn (Subscription $subscription): bool => $this->coversAccessDate($subscription, $checkIn));

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

        if (! $this->coversAccessDate($latest, $checkIn)) {
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

    private function coversAccessDate(Subscription $subscription, Carbon $checkIn): bool
    {
        if ($subscription->end_date === null) {
            return false;
        }

        $graceDays = (int) ($subscription->plan?->access_grace_days ?? 0);

        return $subscription->end_date->copy()->addDays($graceDays)->gte($checkIn->copy()->startOfDay());
    }
}
