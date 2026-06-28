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

        $plan = isset($data['plan_id'])
            ? Plan::query()->findOrFail($data['plan_id'])
            : $subscription->plan;

        $today = Carbon::today();
        $startDate = $subscription->status !== 'expired' && $subscription->end_date !== null && $subscription->end_date->gte($today)
            ? $subscription->end_date->copy()->addDay()
            : $today;

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
            'start_date' => $startDate->toDateString(),
            'discount' => $data['discount'] ?? 0,
            'payment' => $data['payment'],
        ], $seller);
    }
}
