<?php

namespace App\Console\Commands;

use App\Actions\Commissions\CalculateCommission;
use App\Models\Commission;
use App\Models\Employee;
use App\Models\Sale;
use App\Models\Subscription;
use Illuminate\Console\Command;

class BackfillCommissionsCommand extends Command
{
    protected $signature = 'commissions:backfill {--from=} {--to=} {--dry-run}';

    protected $description = 'Backfill commissions for historical subscriptions and sales.';

    public function handle(CalculateCommission $action): int
    {
        $from = $this->option('from');
        $to = $this->option('to');
        $dryRun = $this->option('dry-run') ? true : false;

        $results = $this->executeBackfill($action, $from, $to, $dryRun);

        $this->info("Scanned: {$results['scanned']}");
        $this->info("Created: {$results['created']}");
        $this->info("Skipped (unlinked/zero rate): {$results['skipped_unlinked']}");
        $this->info("Already present: {$results['already_present']}");

        return self::SUCCESS;
    }

    public function executeBackfill(CalculateCommission $action, ?string $from, ?string $to, bool $dryRun): array
    {
        $created = 0;
        $skippedUnlinked = 0;
        $alreadyPresent = 0;
        $scanned = 0;

        $linkedUserIds = Employee::whereNotNull('user_id')
            ->pluck('user_id')
            ->toArray();

        // 1. Chunk Subscriptions
        $subQuery = Subscription::query()
            ->whereIn('sold_by_user_id', $linkedUserIds);

        if ($from) {
            $subQuery->where('created_at', '>=', $from);
        }
        if ($to) {
            $subQuery->where('created_at', '<=', $to);
        }

        $subQuery->chunk(100, function ($subscriptions) use ($action, $dryRun, &$created, &$skippedUnlinked, &$alreadyPresent, &$scanned) {
            foreach ($subscriptions as $subscription) {
                $scanned++;

                // Check if commission already exists
                $exists = Commission::where('source_type', Subscription::class)
                    ->where('source_id', $subscription->id)
                    ->exists();

                if ($exists) {
                    $alreadyPresent++;

                    continue;
                }

                if ($dryRun) {
                    $employee = Employee::where('user_id', $subscription->sold_by_user_id)->first();
                    $rate = '0.0000';
                    if ($employee && $employee->status === 'active') {
                        $plan = $subscription->plan;
                        $rate = ($plan && $plan->commission_rate !== null) ? (string) $plan->commission_rate : (string) $employee->commission_rate;
                    }
                    if ($employee && bccomp($rate, '0.0000', 4) > 0) {
                        // Under dryRun, nothing is created
                    } else {
                        $skippedUnlinked++;
                    }
                } else {
                    $commission = $action->forSource($subscription);
                    if ($commission) {
                        $created++;
                    } else {
                        $skippedUnlinked++;
                    }
                }
            }
        });

        // 2. Chunk Sales
        $saleQuery = Sale::query()
            ->whereIn('sold_by_user_id', $linkedUserIds)
            ->where('status', 'completed');

        if ($from) {
            $saleQuery->where('created_at', '>=', $from);
        }
        if ($to) {
            $saleQuery->where('created_at', '<=', $to);
        }

        $saleQuery->chunk(100, function ($sales) use ($action, $dryRun, &$created, &$skippedUnlinked, &$alreadyPresent, &$scanned) {
            foreach ($sales as $sale) {
                $scanned++;

                // Check if commission already exists
                $exists = Commission::where('source_type', Sale::class)
                    ->where('source_id', $sale->id)
                    ->exists();

                if ($exists) {
                    $alreadyPresent++;

                    continue;
                }

                if ($dryRun) {
                    $employee = Employee::where('user_id', $sale->sold_by_user_id)->first();
                    $rate = '0.0000';
                    if ($employee && $employee->status === 'active') {
                        $rate = (string) $employee->commission_rate;
                    }
                    if ($employee && bccomp($rate, '0.0000', 4) > 0) {
                        // Under dryRun, nothing is created
                    } else {
                        $skippedUnlinked++;
                    }
                } else {
                    $commission = $action->forSource($sale);
                    if ($commission) {
                        $created++;
                    } else {
                        $skippedUnlinked++;
                    }
                }
            }
        });

        return [
            'created' => $created,
            'skipped_unlinked' => $skippedUnlinked,
            'already_present' => $alreadyPresent,
            'scanned' => $scanned,
        ];
    }
}
