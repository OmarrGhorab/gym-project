<?php

namespace App\Console\Commands;

use App\Models\Subscription;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

class MarkExpiredSubscriptions extends Command
{
    protected $signature = 'subscriptions:mark-expired';

    protected $description = 'Mark active subscriptions as expired when their end_date has passed.';

    public function handle(): int
    {
        $count = 0;

        Subscription::query()
            ->with('plan')
            ->where('status', 'active')
            ->where('end_date', '<', Carbon::today()->toDateString())
            ->chunkById(100, function ($subscriptions) use (&$count): void {
                foreach ($subscriptions as $subscription) {
                    $graceDays = (int) ($subscription->plan?->access_grace_days ?? 0);

                    if ($subscription->end_date->copy()->addDays($graceDays)->gte(Carbon::today())) {
                        continue;
                    }

                    $subscription->update(['status' => 'expired']);
                    $count++;
                }
            });

        $this->info("Marked {$count} subscription(s) as expired.");

        return self::SUCCESS;
    }
}
