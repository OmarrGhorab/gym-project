<?php

namespace App\Actions\Commissions;

use App\Models\Commission;
use App\Models\Payroll;
use App\Models\Subscription;
use App\Models\SubscriptionAddon;
use Illuminate\Support\Carbon;

final class ReverseRefundedCommissions
{
    public function __construct(private readonly CalculateCommission $calculateCommission) {}

    /**
     * Reverse commissions for refunded subscription sources.
     *
     * Pending commissions are offset in their original payroll month. Paid
     * commissions are recovered in the current open payroll month, preserving
     * the original paid payroll as an immutable historical record.
     *
     * @param  iterable<Subscription|SubscriptionAddon>  $sources
     */
    public function handle(iterable $sources, string $refundAmount, string $paidTotal): int
    {
        if (bccomp($refundAmount, '0.00', 2) <= 0 || bccomp($paidTotal, '0.00', 2) <= 0) {
            return 0;
        }

        $ratio = bccomp($refundAmount, $paidTotal, 2) >= 0
            ? '1.000000'
            : bcdiv($refundAmount, $paidTotal, 6);
        $created = 0;

        foreach ($sources as $source) {
            // A queued live-calculation job may not have run yet. Materialize
            // the source commissions synchronously so a later job cannot add
            // an unreversed commission after the refund has completed.
            $this->calculateCommission->forSource($source);

            $commissions = Commission::query()
                ->where('source_type', get_class($source))
                ->where('source_id', $source->id)
                ->lockForUpdate()
                ->get()
                ->reject(fn (Commission $commission): bool => str_ends_with($commission->commission_type, '_refund'));

            foreach ($commissions as $commission) {
                if (bccomp((string) $commission->amount, '0.00', 2) <= 0) {
                    continue;
                }

                $reversedAmount = bcmul((string) $commission->amount, $ratio, 2);
                if (bccomp($reversedAmount, '0.00', 2) <= 0) {
                    continue;
                }

                $reversal = Commission::query()->firstOrCreate(
                    [
                        'source_type' => $commission->source_type,
                        'source_id' => $commission->source_id,
                        'employee_id' => $commission->employee_id,
                        'commission_type' => $commission->commission_type.'_refund',
                    ],
                    [
                        'calculation_type' => 'refund',
                        'rate' => $commission->rate,
                        'rule_value' => $commission->rule_value,
                        'amount' => bcmul($reversedAmount, '-1', 2),
                        'month' => $this->reversalMonth($commission),
                        'status' => 'pending',
                        'employee_plan_commission_rule_id' => $commission->employee_plan_commission_rule_id,
                    ],
                );

                if ($reversal->wasRecentlyCreated) {
                    $created++;
                }
            }
        }

        return $created;
    }

    private function reversalMonth(Commission $commission): string
    {
        if ($commission->status === 'pending') {
            return $commission->month;
        }

        $month = Carbon::now()->startOfMonth();

        while (Payroll::query()
            ->where('employee_id', $commission->employee_id)
            ->where('month', $month->format('Y-m'))
            ->where('status', 'paid')
            ->exists()) {
            $month->addMonth();
        }

        return $month->format('Y-m');
    }
}
