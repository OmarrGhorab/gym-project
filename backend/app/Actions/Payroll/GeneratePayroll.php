<?php

namespace App\Actions\Payroll;

use App\Models\Commission;
use App\Models\Employee;
use App\Models\Payroll;

final class GeneratePayroll
{
    /**
     * Generate payroll for all active employees for the target month.
     *
     * @return array<Payroll>
     */
    public function execute(string $month): array
    {
        $activeEmployees = Employee::active()->get();
        $generated = [];

        foreach ($activeEmployees as $employee) {
            // Check if already exists
            $exists = Payroll::where('employee_id', $employee->id)
                ->where('month', $month)
                ->exists();

            if ($exists) {
                continue;
            }

            // Calculate pending commissions for this month
            $commissionsTotal = Commission::where('employee_id', $employee->id)
                ->where('month', $month)
                ->where('status', 'pending')
                ->sum('amount');

            $netSalary = bcadd((string) $employee->base_salary, (string) $commissionsTotal, 2);

            $payroll = Payroll::create([
                'employee_id' => $employee->id,
                'month' => $month,
                'base_salary' => $employee->base_salary,
                'commissions_total' => $commissionsTotal,
                'bonuses' => 0.00,
                'deductions' => 0.00,
                'net_salary' => $netSalary,
                'status' => 'pending',
            ]);

            $generated[] = $payroll;
        }

        return $generated;
    }
}
