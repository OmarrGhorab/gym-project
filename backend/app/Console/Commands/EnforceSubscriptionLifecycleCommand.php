<?php

namespace App\Console\Commands;

use App\Actions\Subscriptions\AutoUnfreezeDueSubscriptions;
use App\Actions\Subscriptions\StopOverdueUnpaidSubscriptions;
use Illuminate\Console\Command;

class EnforceSubscriptionLifecycleCommand extends Command
{
    protected $signature = 'subscriptions:enforce-lifecycle';

    protected $description = 'Auto-unfreeze completed freezes and stop overdue unpaid subscriptions.';

    public function handle(
        AutoUnfreezeDueSubscriptions $autoUnfreeze,
        StopOverdueUnpaidSubscriptions $stopOverdueUnpaid,
    ): int {
        $unfrozen = $autoUnfreeze->handle();
        $stopped = $stopOverdueUnpaid->handle();

        $this->info("Auto-unfrozen {$unfrozen} subscription(s).");
        $this->info("Stopped {$stopped} overdue unpaid subscription(s).");

        return self::SUCCESS;
    }
}
