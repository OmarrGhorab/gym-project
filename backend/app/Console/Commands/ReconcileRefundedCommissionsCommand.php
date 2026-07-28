<?php

namespace App\Console\Commands;

use App\Actions\Commissions\ReconcileRefundedCommissions;
use Illuminate\Console\Command;

final class ReconcileRefundedCommissionsCommand extends Command
{
    protected $signature = 'commissions:reconcile-refunds {--dry-run : Show repairs without saving them}';

    protected $description = 'Create missing commission reversals for historical subscription refunds.';

    public function handle(ReconcileRefundedCommissions $reconcile): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $results = $reconcile->execute($dryRun);

        $this->info($dryRun ? 'Dry run only; no changes were saved.' : 'Historical refund commissions reconciled.');
        $this->line("Subscription refunds checked: {$results['subscription_refunds']}");
        $this->line("Add-on refunds checked: {$results['addon_refunds']}");
        $this->line("Commission reversals {$this->verb($dryRun)}: {$results['reversals_created']}");
        $this->line("Pending payrolls {$this->refreshVerb($dryRun)}: {$results['payrolls_refreshed']}");

        return self::SUCCESS;
    }

    private function verb(bool $dryRun): string
    {
        return $dryRun ? 'needed' : 'created';
    }

    private function refreshVerb(bool $dryRun): string
    {
        return $dryRun ? 'that would be refreshed' : 'refreshed';
    }
}
