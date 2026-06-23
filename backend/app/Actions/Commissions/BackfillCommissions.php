<?php

namespace App\Actions\Commissions;

use App\Models\Commission;
use App\Models\Employee;
use App\Models\Sale;
use App\Models\Subscription;

final class BackfillCommissions
{
    /** @return array{created: int, skipped_unlinked: int, already_present: int, scanned: int} */
    public function execute(CalculateCommission $action, ?string $from, ?string $to, bool $dryRun): array
    {
        $created = 0;
        $skippedUnlinked = 0;
        $alreadyPresent = 0;
        $scanned = 0;

        $employeesByUserId = Employee::whereNotNull('user_id')->get()->keyBy('user_id');
        $linkedUserIds = $employeesByUserId->keys()->all();

        $subQuery = Subscription::query()->whereIn('sold_by_user_id', $linkedUserIds);
        if ($from) {
            $subQuery->whereDate('created_at', '>=', $from);
        }
        if ($to) {
            $subQuery->whereDate('created_at', '<=', $to);
        }

        $subQuery->chunkById(100, function ($subscriptions) use ($action, $dryRun, $employeesByUserId, &$created, &$skippedUnlinked, &$alreadyPresent, &$scanned): void {
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
            $saleQuery->whereDate('created_at', '>=', $from);
        }
        if ($to) {
            $saleQuery->whereDate('created_at', '<=', $to);
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
