<?php

namespace App\Actions\Reminders;

use App\Jobs\SendRenewalReminderJob;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;

class SendRenewalReminders
{
    public function __construct(
        private readonly FindExpiringSubscriptions $findExpiringSubscriptions,
    ) {}

    public function handle(): int
    {
        $count = 0;
        $today = Carbon::today();

        $this->findExpiringSubscriptions
            ->query()
            ->orderBy('subscriptions.id')
            ->chunkById(500, function ($subscriptions) use (&$count, $today): void {
                foreach ($subscriptions as $subscription) {
                    if (! $this->claim($subscription->id, $today)) {
                        continue;
                    }

                    SendRenewalReminderJob::dispatch($subscription->id);
                    $count++;
                }
            }, column: 'subscriptions.id', alias: 'id');

        return $count;
    }

    /**
     * Reserve today's reminder for a subscription so that re-running the
     * command on the same day cannot queue a duplicate job while the first
     * one is still waiting on the worker (the queued job only stamps
     * `last_reminded_on` once it has actually been processed).
     */
    private function claim(int $subscriptionId, Carbon $today): bool
    {
        return Cache::add(
            "renewal-reminder:{$subscriptionId}:{$today->toDateString()}",
            true,
            $today->copy()->endOfDay(),
        );
    }
}
