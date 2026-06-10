<?php

namespace App\Jobs;

use App\Models\Subscription;
use App\Notifications\SubscriptionRenewalReminder;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Carbon;

class SendRenewalReminderJob implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public int $subscriptionId,
    ) {}

    public function handle(): void
    {
        $subscription = Subscription::query()
            ->with(['member', 'soldBy'])
            ->findOrFail($this->subscriptionId);

        $today = Carbon::today();

        if ($subscription->last_reminded_on?->isSameDay($today)) {
            return;
        }

        if ($subscription->soldBy) {
            $subscription->soldBy->notify(new SubscriptionRenewalReminder([
                'subscription_id' => $subscription->id,
                'member_name' => $subscription->member?->name,
                'end_date' => $subscription->end_date?->toDateString(),
            ]));
        }

        $subscription->update([
            'last_reminded_on' => $today->toDateString(),
        ]);
    }
}
