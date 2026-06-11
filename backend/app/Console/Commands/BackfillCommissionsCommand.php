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

        // Pre-map linked employees by user_id once — avoids a per-row lookup
        // during the dry-run rate probe (N+1).
        $employeesByUserId = Employee::whereNotNull('user_id')->get()->keyBy('user_id');
        $linkedUserIds = $employeesByUserId->keys()->all();

        $subQuery = Subscription::query()->whereIn('sold_by_user_id', $linkedUserIds);
        if ($from) {
            $subQuery->where('created_at', '>=', $from);
        }
        if ($to) {
            $subQuery->where('created_at', '<=', $to);
        }

        $subQuery->chunkById(100, function ($subscriptions) use ($action, $dryRun, $employeesByUserId, &$created, &$skippedUnlinked, &$alreadyPresent, &$scanned): void {
            // Batch-fetch which sources in this chunk already have a commission —
            // one query per chunk instead of one ->exists() per row.
            $existing = Commission::where('source_type', Subscription::class)
                ->whereIn('source_id', $subscriptions->modelKeys())
                ->pluck('source_id')
                ->flip();

            foreach ($subscriptions as $subscription) {
                $scanned++;

                if ($existing->has($subscription->id)) {
                    $alreadyPresent++;

                    continue;
                }

                if ($dryRun) {
                    $employee = $employeesByUserId->get($subscription->sold_by_user_id);
                    $rate = '0.0000';
                    if ($employee && $employee->status === 'active') {
                        $plan = $subscription->plan;
                        $rate = ($plan && $plan->commission_rate !== null) ? (string) $plan->commission_rate : (string) $employee->commission_rate;
                    }

                    $employee && bccomp($rate, '0.0000', 4) > 0 ? null : $skippedUnlinked++;
                } else {
                    $action->forSource($subscription) ? $created++ : $skippedUnlinked++;
                }
            }
        });

        $saleQuery = Sale::query()
            ->whereIn('sold_by_user_id', $linkedUserIds)
            ->where('status', 'completed');
        if ($from) {
            $saleQuery->where('created_at', '>=', $from);
        }
        if ($to) {
            $saleQuery->where('created_at', '<=', $to);
        }

        $saleQuery->chunkById(100, function ($sales) use ($action, $dryRun, $employeesByUserId, &$created, &$skippedUnlinked, &$alreadyPresent, &$scanned): void {
            $existing = Commission::where('source_type', Sale::class)
                ->whereIn('source_id', $sales->modelKeys())
                ->pluck('source_id')
                ->flip();

            foreach ($sales as $sale) {
                $scanned++;

                if ($existing->has($sale->id)) {
                    $alreadyPresent++;

                    continue;
                }

                if ($dryRun) {
                    $employee = $employeesByUserId->get($sale->sold_by_user_id);
                    $rate = ($employee && $employee->status === 'active') ? (string) $employee->commission_rate : '0.0000';

                    $employee && bccomp($rate, '0.0000', 4) > 0 ? null : $skippedUnlinked++;
                } else {
                    $action->forSource($sale) ? $created++ : $skippedUnlinked++;
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
