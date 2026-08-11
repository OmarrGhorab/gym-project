<?php

namespace App\Actions\Subscriptions;

use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;

class RenewSubscription
{
    public function __construct(
        private readonly CreateSubscription $createSubscription,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(Subscription $subscription, array $data, User $seller): Subscription
    {
        $subscription->loadMissing(['member', 'plan']);

        // A frozen period has no settled end date yet — it is recalculated from the
        // resume date. Stacking a renewal on the pre-freeze end_date would overlap the
        // days the freeze is protecting, so the freeze has to be resolved first.
        if ($subscription->status === 'frozen') {
            throw ValidationException::withMessages([
                'subscription' => 'Unfreeze this subscription before renewing it.',
            ]);
        }

        $plan = isset($data['plan_id'])
            ? Plan::query()->findOrFail($data['plan_id'])
            : $subscription->plan;

        $today = Carbon::today();

        // Only stack periods for still-live memberships (active/frozen with remaining time).
        // Stopped/expired always restart from today so cancel+renew does not double the period.
        if (in_array($subscription->status, ['stopped', 'expired'], true)) {
            $startDate = $today;
        } elseif ($subscription->end_date !== null && $subscription->end_date->gte($today)) {
            $startDate = $subscription->end_date->copy()->addDay();
        } else {
            $startDate = $today;
        }

        $alreadyRenewed = Subscription::query()
            ->whereKeyNot($subscription->getKey())
            ->where('member_id', $subscription->member_id)
            ->where('plan_id', $plan->id)
            ->where('status', 'active')
            ->whereDate('start_date', '<=', $startDate->toDateString())
            ->whereDate('end_date', '>=', $startDate->toDateString())
            ->exists();

        if ($alreadyRenewed) {
            throw ValidationException::withMessages([
                'subscription' => 'This subscription already has an active renewal for the next period.',
            ]);
        }

        return $this->createSubscription->handle([
            'member_id' => $subscription->member_id,
            'plan_id' => $plan->id,
            // Keep the member with their coach across periods, but only while the plan
            // is unchanged — a different plan may not be one that coach can service.
            'coach_id' => $plan->id === $subscription->plan_id ? $subscription->coach_id : null,
            'start_date' => $startDate->toDateString(),
            'discount' => $data['discount'] ?? 0,
            'payment' => $data['payment'],
            'addons' => $data['addons'] ?? [],
        ], $seller);
    }
}
