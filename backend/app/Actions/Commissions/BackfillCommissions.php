<?php

namespace App\Actions\Commissions;

use App\Models\Commission;
use App\Models\Employee;
use App\Models\Sale;
use App\Models\Subscription;
use App\Models\SubscriptionAddon;

final class BackfillCommissions
{
    /** @return array{created: int, skipped_unlinked: int, already_present: int, scanned: int} */
    public function execute(CalculateCommission $action, ?string $from, ?string $to, bool $dryRun): array
    {
        $created = 0;
        $skippedUnlinked = 0;
        $alreadyPresent = 0;
        $scanned = 0;

        $subQuery = Subscription::query();
        if ($from) {
            $subQuery->whereDate('created_at', '>=', $from);
        }
        if ($to) {
            $subQuery->whereDate('created_at', '<=', $to);
        }

        $subQuery->chunkById(100, function ($subscriptions) use ($action, $dryRun, &$created, &$skippedUnlinked, &$alreadyPresent, &$scanned): void {
            foreach ($subscriptions as $subscription) {
                $scanned++;
                $specs = $action->resolveSpecsForSource($subscription);

                if ($specs === []) {
                    $skippedUnlinked++;

                    continue;
                }

                foreach ($specs as $spec) {
                    $exists = Commission::query()
                        ->where('source_type', Subscription::class)
                        ->where('source_id', $subscription->id)
                        ->where('employee_id', $spec['employee']->id)
                        ->where('commission_type', $spec['commission_type'])
                        ->exists();

                    if ($exists) {
                        $alreadyPresent++;
                        continue;
                    }

                    if ($dryRun) {
                        continue;
                    }

                    $created += $action->forSource($subscription);
                    break;
                }
            }
        });

        $addonQuery = SubscriptionAddon::query();
        if ($from) {
            $addonQuery->whereDate('created_at', '>=', $from);
        }
        if ($to) {
            $addonQuery->whereDate('created_at', '<=', $to);
        }

        $addonQuery->chunkById(100, function ($addons) use ($action, $dryRun, &$created, &$skippedUnlinked, &$alreadyPresent, &$scanned): void {
            foreach ($addons as $addon) {
                $scanned++;
                $specs = $action->resolveSpecsForSource($addon);

                if ($specs === []) {
                    $skippedUnlinked++;

                    continue;
                }

                foreach ($specs as $spec) {
                    $exists = Commission::query()
                        ->where('source_type', SubscriptionAddon::class)
                        ->where('source_id', $addon->id)
                        ->where('employee_id', $spec['employee']->id)
                        ->where('commission_type', $spec['commission_type'])
                        ->exists();

                    if ($exists) {
                        $alreadyPresent++;
                        continue;
                    }

                    if ($dryRun) {
                        continue;
                    }

                    $created += $action->forSource($addon);
                    break;
                }
            }
        });

        $saleQuery = Sale::query()
            ->where('status', 'completed');
        if ($from) {
            $saleQuery->whereDate('created_at', '>=', $from);
        }
        if ($to) {
            $saleQuery->whereDate('created_at', '<=', $to);
        }

        $saleQuery->chunkById(100, function ($sales) use ($action, $dryRun, &$created, &$skippedUnlinked, &$alreadyPresent, &$scanned): void {
            foreach ($sales as $sale) {
                $scanned++;
                $specs = $action->resolveSpecsForSource($sale);

                if ($specs === []) {
                    $skippedUnlinked++;

                    continue;
                }

                foreach ($specs as $spec) {
                    $exists = Commission::query()
                        ->where('source_type', Sale::class)
                        ->where('source_id', $sale->id)
                        ->where('employee_id', $spec['employee']->id)
                        ->where('commission_type', $spec['commission_type'])
                        ->exists();

                    if ($exists) {
                        $alreadyPresent++;
                        continue;
                    }

                    if ($dryRun) {
                        continue;
                    }

                    $created += $action->forSource($sale);
                    break;
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
