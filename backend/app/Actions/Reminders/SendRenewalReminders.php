<?php

namespace App\Actions\Reminders;

use App\Jobs\SendRenewalReminderJob;
class SendRenewalReminders
{
    public function __construct(
        private readonly FindExpiringSubscriptions $findExpiringSubscriptions,
    ) {}

    public function handle(): int
    {
        $count = 0;

        $this->findExpiringSubscriptions
            ->query()
            ->orderBy('subscriptions.id')
            ->chunkById(500, function ($subscriptions) use (&$count): void {
                foreach ($subscriptions as $subscription) {
                    SendRenewalReminderJob::dispatch($subscription->id);
                    $count++;
                }
            }, column: 'subscriptions.id', alias: 'id');

        return $count;
    }
}
