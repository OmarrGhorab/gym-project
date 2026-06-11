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
        $today = Carbon::today()->toDateString();
        $count = 0;

        $this->findExpiringSubscriptions
            ->query()
            ->orderBy('subscriptions.id')
            ->chunkById(500, function ($subscriptions) use ($today, &$count): void {
                foreach ($subscriptions as $subscription) {
                    $subscription->forceFill([
                        'last_reminded_on' => $today,
                    ])->save();

                    SendRenewalReminderJob::dispatch($subscription->id);
                    $count++;
                }
            }, column: 'subscriptions.id', alias: 'id');

        return $count;
    }
}
