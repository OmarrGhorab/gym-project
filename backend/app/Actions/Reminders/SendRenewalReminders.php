<?php

namespace App\Actions\Reminders;

use App\Jobs\SendRenewalReminderJob;
use Illuminate\Support\Carbon;

class SendRenewalReminders
{
    public function __construct(
        private readonly FindExpiringSubscriptions $findExpiringSubscriptions,
    ) {}

    public function handle(): int
    {
        $subscriptions = $this->findExpiringSubscriptions->handle();
        $today = Carbon::today()->toDateString();

        foreach ($subscriptions as $subscription) {
            $subscription->forceFill([
                'last_reminded_on' => $today,
            ])->save();

            SendRenewalReminderJob::dispatch($subscription->id);
        }

        return $subscriptions->count();
    }
}
