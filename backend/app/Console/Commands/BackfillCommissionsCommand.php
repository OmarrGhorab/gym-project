<?php

namespace App\Console\Commands;

use App\Actions\Commissions\BackfillCommissions;
use App\Actions\Commissions\CalculateCommission;
use Illuminate\Console\Command;

class BackfillCommissionsCommand extends Command
{
    protected $signature = 'commissions:backfill {--from=} {--to=} {--dry-run}';

    protected $description = 'Backfill commissions for historical subscriptions and sales.';

    public function handle(CalculateCommission $action, BackfillCommissions $backfill): int
    {
        $from = $this->option('from');
        $to = $this->option('to');
        $dryRun = $this->option('dry-run') ? true : false;

        $results = $backfill->execute($action, $from, $to, $dryRun);

        $this->info("Scanned: {$results['scanned']}");
        $this->info("Created: {$results['created']}");
        $this->info("Skipped (unlinked/zero rate): {$results['skipped_unlinked']}");
        $this->info("Already present: {$results['already_present']}");

        return self::SUCCESS;
    }
}
