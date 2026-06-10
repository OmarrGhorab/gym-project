<?php

namespace App\Console\Commands;

use App\Actions\Reminders\SendRenewalReminders;
use Illuminate\Console\Command;

class SendRenewalRemindersCommand extends Command
{
    protected $signature = 'subscriptions:send-renewal-reminders';

    protected $description = 'Dispatch queued renewal reminders for expiring subscriptions.';

    public function handle(SendRenewalReminders $action): int
    {
        $count = $action->handle();

        $this->info("Dispatched {$count} renewal reminder job(s).");

        return self::SUCCESS;
    }
}
