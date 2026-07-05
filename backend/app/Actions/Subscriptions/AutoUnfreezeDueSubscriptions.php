<?php

namespace App\Actions\Subscriptions;

use App\Models\Subscription;
use Illuminate\Support\Carbon;

class AutoUnfreezeDueSubscriptions
{
    public function __construct(
        private readonly UnfreezeSubscription $unfreezeSubscription,
    ) {}

    public function handle(?Carbon $today = null): int
    {
        $today ??= Carbon::today();
        $count = 0;

        Subscription::query()
            ->where('status', 'frozen')
            ->whereHas('freezes', function ($query) use ($today): void {
                $query
                    ->whereNull('resumed_on')
                    ->whereDate('freeze_end', '<', $today->toDateString());
            })
            ->with(['freezes'])
            ->chunkById(100, function ($subscriptions) use (&$count): void {
                foreach ($subscriptions as $subscription) {
                    $openFreeze = $subscription->freezes
                        ->whereNull('resumed_on')
                        ->sortByDesc('freeze_end')
                        ->first();

                    if ($openFreeze === null || $openFreeze->freeze_end === null) {
                        continue;
                    }

                    $this->unfreezeSubscription->handle($subscription, [
                        'resume_on' => $openFreeze->freeze_end->copy()->addDay()->toDateString(),
                    ]);

                    $count++;
                }
            });

        return $count;
    }
}
