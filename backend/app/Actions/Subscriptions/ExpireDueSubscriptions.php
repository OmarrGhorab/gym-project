<?php

namespace App\Actions\Subscriptions;

use App\Models\Subscription;
use Illuminate\Support\Carbon;

class ExpireDueSubscriptions
{
    public function handle(): int
    {
        $count = 0;

        Subscription::query()
            ->with('plan')
            ->where('status', 'active')
            ->whereDate('end_date', '<', Carbon::today()->toDateString())
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

        return $count;
    }
}
