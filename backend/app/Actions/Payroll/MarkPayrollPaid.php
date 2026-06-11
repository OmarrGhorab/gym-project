<?php

namespace App\Actions\Payroll;

use App\Models\Commission;
use App\Models\Expense;
use App\Models\Payroll;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class MarkPayrollPaid
{
    /**
     * Mark a payroll entry as paid and record a matching expense payout.
     */
    public function execute(Payroll $payroll, User $user): Payroll
    {
        if ($payroll->status === 'paid') {
            throw ValidationException::withMessages([
                'status' => 'This payroll has already been paid.',
            ]);
        }

        return DB::transaction(function () use ($payroll, $user) {
            // Reconcile commissions at payment time.
            //
            // Generation snapshots commissions_total from the commissions that
            // existed then, but the live observer keeps creating commissions for
            // the same month afterwards. If we blindly flipped every pending
            // commission to "paid" while paying the stale snapshot, those late
            // commissions would be marked paid without ever being paid for
            // (silent underpayment). Instead we re-sum the pending commissions we
            // are about to settle, recompute net against them, and pay exactly
            // that — so the payout always equals the commissions being flipped.
            $pendingCommissions = Commission::query()
                ->where('employee_id', $payroll->employee_id)
                ->where('month', $payroll->month)
                ->where('status', 'pending')
                ->lockForUpdate()
                ->get();

            $commissionsTotal = $pendingCommissions->reduce(
                static fn (string $carry, Commission $commission): string => bcadd($carry, (string) $commission->amount, 2),
                '0.00',
            );

            $netSalary = bcsub(
                bcadd(
                    bcadd((string) $payroll->base_salary, $commissionsTotal, 2),
                    (string) $payroll->bonuses,
                    2,
                ),
                (string) $payroll->deductions,
                2,
            );

            if (bccomp($netSalary, '0.00', 2) === -1) {
                throw ValidationException::withMessages([
                    'net_salary' => 'Net salary cannot be negative.',
                ]);
            }

            $payroll->update([
                'commissions_total' => $commissionsTotal,
                'net_salary' => $netSalary,
                'status' => 'paid',
                'paid_at' => now(),
            ]);

            // Flip exactly the commissions we just settled (and paid for).
            if ($pendingCommissions->isNotEmpty()) {
                Commission::query()
                    ->whereKey($pendingCommissions->modelKeys())
                    ->update(['status' => 'paid']);
            }

            // Create Expense record for the reconciled payout.
            Expense::create([
                'category' => 'payroll',
                'amount' => $netSalary,
                'description' => "Salary payout for {$payroll->employee?->name} - Month: {$payroll->month}",
                'date' => now()->toDateString(),
                'created_by' => $user->id,
            ]);

            Cache::forget('dashboard:summary:v1');

            return $payroll->fresh();
        });
    }
}
