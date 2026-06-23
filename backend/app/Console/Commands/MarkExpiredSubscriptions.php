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
        $count = Subscription::query()
            ->where('status', 'active')
            ->where('end_date', '<', Carbon::today()->toDateString())
            ->update(['status' => 'expired']);

        $this->info("Marked {$count} subscription(s) as expired.");

        return self::SUCCESS;
    }
}
