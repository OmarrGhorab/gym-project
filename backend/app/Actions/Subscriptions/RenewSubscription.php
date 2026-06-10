<?php

namespace App\Actions\Subscriptions;

use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Support\Carbon;

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

        return $this->createSubscription->handle([
            'member_id' => $subscription->member_id,
            'plan_id' => $plan->id,
            'start_date' => $startDate->toDateString(),
            'discount' => $data['discount'] ?? 0,
            'payment' => $data['payment'],
        ], $seller);
    }
}
