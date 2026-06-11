<?php

namespace App\Actions\Commissions;

use App\Models\Commission;
use App\Models\Employee;
use App\Models\Sale;
use App\Models\Subscription;
use Illuminate\Support\Facades\Log;

final class CalculateCommission
{
    /**
     * Calculate and store commission for a given subscription or sale.
     */
    public function forSource(Subscription|Sale $source): ?Commission
    {
        $userId = $source->sold_by_user_id;

        if (! $userId) {
            Log::info("Skipping commission for source {$source->id} (type: ".get_class($source).') - no sold_by_user_id.');

            return null;
        }

        // Find linked employee
        $employee = Employee::where('user_id', $userId)->first();

        if (! $employee) {
            Log::info("Skipping commission for source {$source->id} (type: ".get_class($source).") - user {$userId} is not linked to any employee.");

            return null;
        }

        // Exclude inactive employees
        if ($employee->status !== 'active') {
            Log::info("Skipping commission for source {$source->id} - employee {$employee->id} is inactive.");

            return null;
        }

        // Determine rate
        $rate = '0.0000';
        if ($source instanceof Subscription) {
            $plan = $source->plan;
            if ($plan && $plan->commission_rate !== null) {
                $rate = (string) $plan->commission_rate;
            } else {
                $rate = (string) $employee->commission_rate;
            }
            $base = (string) $source->price_paid;
        } elseif ($source instanceof Sale) {
            $rate = (string) $employee->commission_rate;
            $base = (string) $source->total;
        } else {
            return null;
        }

        if (bccomp($rate, '0.0000', 4) === 0) {
            Log::info("Skipping commission for source {$source->id} - resolved commission rate is 0.");

            return null;
        }

        // Calculate amount
        $amount = bcmul($base, $rate, 2);
        $month = $source->created_at ? $source->created_at->format('Y-m') : now()->format('Y-m');

        // Create commission idempotently
        return Commission::firstOrCreate(
            [
                'source_type' => get_class($source),
                'source_id' => $source->id,
            ],
            [
                'employee_id' => $employee->id,
                'rate' => $rate,
                'amount' => $amount,
                'month' => $month,
                'status' => 'pending',
            ]
        );
    }
}
