<?php

namespace App\Actions\MemberVisits;

use App\Models\Member;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\SubscriptionAddon;
use App\Services\OperationalNotifier;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;

final class ResolveMemberVisitSubscription
{
    /**
     * Resolve the member's gym-access subscription, enforce access rules, and
     * deduct one session when the plan is limited.
     *
     * @throws ValidationException when check-in is not allowed
     */
    public function consume(Member $member, Carbon $checkIn): Subscription
    {
        $candidates = $member->subscriptions()
            ->with('plan')
            ->where('status', 'active')
            ->whereDate('start_date', '<=', $checkIn->toDateString())
            ->latest('end_date')
            ->lockForUpdate()
            ->get();

        if ($candidates->isEmpty()) {
            throw ValidationException::withMessages([
                'member_id' => $this->fallbackReason($member, $checkIn),
            ]);
        }

        $outOfHours = null;
        $noSessions = null;
        $expired = null;

        foreach ($candidates as $subscription) {
            if (! $this->coversAccessDate($subscription, $checkIn)) {
                $expired = $subscription;

                continue;
            }

            if (! $this->planAllowsAccessAt($subscription->plan, $checkIn)) {
                $outOfHours = $subscription;

                continue;
            }

            if ($subscription->sessions_remaining !== null && (int) $subscription->sessions_remaining < 1) {
                $noSessions = $subscription;

                continue;
            }

            if ($subscription->sessions_remaining !== null) {
                $subscription->decrement('sessions_remaining');
                $subscription->refresh();

                if ((int) $subscription->sessions_remaining === 0) {
                    app(OperationalNotifier::class)->subscriptionSessionsFinished($subscription);
                }
            }

            return $subscription;
        }

        if ($outOfHours) {
            $window = $this->accessWindowLabel($outOfHours->plan);
            throw ValidationException::withMessages([
                'member_id' => $window
                    ? "Membership access is only allowed between {$window}. Check-in is outside that window."
                    : 'Membership does not allow access at this time.',
            ]);
        }

        if ($noSessions) {
            throw ValidationException::withMessages([
                'member_id' => 'Membership has no sessions remaining.',
            ]);
        }

        if ($expired) {
            throw ValidationException::withMessages([
                'member_id' => 'Membership is expired (including any access grace days).',
            ]);
        }

        throw ValidationException::withMessages([
            'member_id' => $this->fallbackReason($member, $checkIn),
        ]);
    }

    /**
     * Enforce the same session + access-window rules for a subscription add-on
     * and deduct one limited session when applicable.
     *
     * @throws ValidationException
     */
    public function consumeAddon(Member $member, Carbon $checkIn, int $addonId): SubscriptionAddon
    {
        $addon = SubscriptionAddon::query()
            ->with('plan')
            ->whereKey($addonId)
            ->where('member_id', $member->id)
            ->lockForUpdate()
            ->first();

        if (! $addon) {
            throw ValidationException::withMessages([
                'subscription_addon_id' => 'Add-on not found for this member.',
            ]);
        }

        if ($addon->status !== 'active') {
            throw ValidationException::withMessages([
                'subscription_addon_id' => "Add-on is {$addon->status}.",
            ]);
        }

        if ($addon->start_date && $addon->start_date->gt($checkIn->copy()->startOfDay())) {
            throw ValidationException::withMessages([
                'subscription_addon_id' => 'Add-on has not started yet.',
            ]);
        }

        if ($addon->end_date) {
            $graceDays = (int) ($addon->plan?->access_grace_days ?? 0);
            if ($addon->end_date->copy()->addDays($graceDays)->lt($checkIn->copy()->startOfDay())) {
                throw ValidationException::withMessages([
                    'subscription_addon_id' => 'Add-on is expired.',
                ]);
            }
        }

        if (! $this->planAllowsAccessAt($addon->plan, $checkIn)) {
            $window = $this->accessWindowLabel($addon->plan);
            throw ValidationException::withMessages([
                'subscription_addon_id' => $window
                    ? "Add-on access is only allowed between {$window}."
                    : 'Add-on does not allow access at this time.',
            ]);
        }

        if ($addon->sessions_remaining !== null && (int) $addon->sessions_remaining < 1) {
            throw ValidationException::withMessages([
                'subscription_addon_id' => 'Add-on has no sessions remaining.',
            ]);
        }

        if ($addon->sessions_remaining !== null) {
            $addon->decrement('sessions_remaining');
            $addon->refresh();
        }

        return $addon;
    }

    public function alertReason(Member $member, Carbon $checkIn): string
    {
        return $this->fallbackReason($member, $checkIn);
    }

    private function fallbackReason(Member $member, Carbon $checkIn): string
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

        if ($latest->sessions_remaining !== null && (int) $latest->sessions_remaining < 1) {
            return 'Subscription has no sessions remaining.';
        }

        if (! $this->planAllowsAccessAt($latest->plan, $checkIn)) {
            return 'Subscription does not allow access at this time.';
        }

        return 'No active subscription covers this visit.';
    }

    private function coversAccessDate(Subscription $subscription, Carbon $checkIn): bool
    {
        if ($subscription->end_date === null) {
            return false;
        }

        $graceDays = (int) ($subscription->plan?->access_grace_days ?? 0);

        return $subscription->end_date->copy()->addDays($graceDays)->gte($checkIn->copy()->startOfDay());
    }

    private function planAllowsAccessAt(?Plan $plan, Carbon $checkIn): bool
    {
        if (! $plan) {
            return true;
        }

        return $plan->allowsAccessAt($checkIn);
    }

    private function accessWindowLabel(?Plan $plan): ?string
    {
        if (! $plan || $plan->access_starts_at === null || $plan->access_ends_at === null) {
            return null;
        }

        $start = $this->formatClock((string) $plan->access_starts_at);
        $end = $this->formatClock((string) $plan->access_ends_at);

        return "{$start} and {$end}";
    }

    private function formatClock(string $value): string
    {
        $value = strlen($value) === 5 ? $value.':00' : $value;

        try {
            return Carbon::createFromFormat('H:i:s', $value)->format('H:i');
        } catch (\Throwable) {
            return $value;
        }
    }
}
