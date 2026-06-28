<?php

namespace App\Actions\Payroll;

use App\Models\Commission;
use App\Models\Employee;
use App\Models\Payroll;

final class GeneratePayroll
{
    public function __construct(private readonly ApplyAttendanceDeductions $attendanceDeductions) {}

    /**
     * Generate payroll for all active employees for the target month.
     *
     * @return array{generated: array<Payroll>, generated_count: int, skipped_count: int}
     */
    public function execute(string $month): array
    {
        $activeEmployees = Employee::active()->get();

        if ($activeEmployees->isEmpty()) {
            return ['generated' => [], 'generated_count' => 0, 'skipped_count' => 0];
        }

        $employeeIds = $activeEmployees->pluck('id')->all();

        // Bulk pre-load: existing payroll IDs for this month
        $existingPayrollEmployeeIds = Payroll::whereIn('employee_id', $employeeIds)
            ->where('month', $month)
            ->pluck('employee_id')
            ->flip();

        // Bulk pre-load: commission totals for this month
        $commissionTotals = Commission::whereIn('employee_id', $employeeIds)
            ->where('month', $month)
            ->where('status', 'pending')
            ->groupBy('employee_id')
            ->selectRaw('employee_id, SUM(amount) as total')
            ->pluck('total', 'employee_id');

        $generated = [];

        foreach ($activeEmployees as $employee) {
            if ($existingPayrollEmployeeIds->has($employee->id)) {
                continue;
            }

            $commissionsTotal = $commissionTotals->get($employee->id, '0.00');

            $netSalary = bcadd((string) $employee->base_salary, (string) $commissionsTotal, 2);

            $payroll = new Payroll([
                'employee_id' => $employee->id,
                'month' => $month,
                'base_salary' => $employee->base_salary,
                'commissions_total' => $commissionsTotal,
                'bonuses' => 0.00,
                'deductions' => 0.00,
                'attendance_deductions' => 0.00,
                'net_salary' => $netSalary,
                'status' => 'pending',
            ]);

            $payroll = $this->attendanceDeductions->execute($payroll);
            $payroll->net_salary = bcsub((string) $payroll->net_salary, (string) $payroll->attendance_deductions, 2);
            $payroll->save();
            $this->attendanceDeductions->execute($payroll);
            $payroll->save();

            $generated[] = $payroll;
        }

        $skipped = $activeEmployees->count() - count($generated);

        return [
            'generated' => $generated,
            'generated_count' => count($generated),
            'skipped_count' => $skipped,
        ];
    }
}
