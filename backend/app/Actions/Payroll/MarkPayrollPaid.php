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
            // Update payroll
            $payroll->update([
                'status' => 'paid',
                'paid_at' => now(),
            ]);

            // Mark commissions as paid
            Commission::where('employee_id', $payroll->employee_id)
                ->where('month', $payroll->month)
                ->where('status', 'pending')
                ->update(['status' => 'paid']);

            // Create Expense record
            Expense::create([
                'category' => 'payroll',
                'amount' => $payroll->net_salary,
                'description' => "Salary payout for {$payroll->employee?->name} - Month: {$payroll->month}",
                'date' => now()->toDateString(),
                'created_by' => $user->id,
            ]);

            Cache::forget('dashboard:summary:v1');

            return $payroll->fresh();
        });
    }
}
