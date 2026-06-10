<?php

namespace App\Console\Commands;

use App\Actions\Subscriptions\ExpireDueSubscriptions;
use Illuminate\Console\Command;

class ExpireSubscriptionsCommand extends Command
{
    protected $signature = 'subscriptions:expire';

    protected $description = 'Expire active subscriptions whose end date has passed.';

    public function handle(ExpireDueSubscriptions $action): int
    {
        $count = $action->handle();

        $this->info("Expired {$count} subscription(s).");

        return self::SUCCESS;
    }
}
