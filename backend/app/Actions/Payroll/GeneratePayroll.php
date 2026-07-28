<?php

namespace App\Actions\Payroll;

use App\Models\Commission;
use App\Models\Employee;
use App\Models\Payroll;

final class GeneratePayroll
{
    public function __construct(
        private readonly ApplyAttendanceDeductions $attendanceDeductions,
        private readonly ApplyAttendanceBonuses $attendanceBonuses,
    ) {}

    /**
     * Generate payroll for all active employees for the target month.
     *
     * @return array{generated: array<Payroll>, generated_count: int, refreshed_count: int, skipped_count: int}
     */
    public function execute(string $month): array
    {
        $activeEmployees = Employee::active()->get();

        if ($activeEmployees->isEmpty()) {
            return ['generated' => [], 'generated_count' => 0, 'refreshed_count' => 0, 'skipped_count' => 0];
        }

        $employeeIds = $activeEmployees->pluck('id')->all();

        // Bulk pre-load: existing payroll IDs for this month
        $existingPayrolls = Payroll::whereIn('employee_id', $employeeIds)
            ->where('month', $month)
            ->get()
            ->keyBy('employee_id');

        // Bulk pre-load: commission totals for this month
        $commissionTotals = Commission::whereIn('employee_id', $employeeIds)
            ->where('month', $month)
            ->where('status', 'pending')
            ->groupBy('employee_id')
            ->selectRaw('employee_id, SUM(amount) as total')
            ->pluck('total', 'employee_id');

        $generated = [];
        $refreshed = [];
        $skipped = 0;

        foreach ($activeEmployees as $employee) {
            $existingPayroll = $existingPayrolls->get($employee->id);

            if ($existingPayroll) {
                if ($existingPayroll->status !== 'pending') {
                    $skipped++;

                    continue;
                }

                $this->refreshPendingPayroll($existingPayroll, $employee);
                $refreshed[] = $existingPayroll->fresh(['employee']);

                continue;
            }

            $commissionsTotal = $commissionTotals->get($employee->id, '0.00');
            $netSalary = bcadd((string) $employee->base_salary, (string) $commissionsTotal, 2);

            $payroll = new Payroll([
                'employee_id' => $employee->id,
                'month' => $month,
                'base_salary' => $employee->base_salary,
                'commissions_total' => $commissionsTotal,
                'bonuses' => '0.00',
                'deductions' => 0.00,
                'attendance_deductions' => 0.00,
                'net_salary' => $netSalary,
                'status' => 'pending',
            ]);

            $payroll = $this->attendanceDeductions->execute($payroll);
            $payroll->net_salary = bcsub((string) $payroll->net_salary, (string) $payroll->attendance_deductions, 2);
            $payroll = $this->attendanceBonuses->execute($payroll);
            $payroll->save();
            $this->attendanceDeductions->execute($payroll);
            $this->attendanceBonuses->execute($payroll);
            $payroll->save();

            $generated[] = $payroll;
        }

        $skipped = $activeEmployees->count() - count($generated) - count($refreshed);

        return [
            'generated' => [...$generated, ...$refreshed],
            'generated_count' => count($generated),
            'refreshed_count' => count($refreshed),
            'skipped_count' => $skipped,
        ];
    }

    public function refreshPendingPayroll(Payroll $payroll, ?Employee $employee = null): void
    {
        if ($payroll->status !== 'pending') {
            return;
        }

        $employee ??= Employee::query()->find($payroll->employee_id);

        // Keep pending payroll in sync with the employee profile (e.g. base salary updates).
        if ($employee !== null) {
            $payroll->base_salary = $employee->base_salary;
        }

        $payroll->commissions_total = $this->commissionTotal($payroll->employee_id, $payroll->month);
        $payroll = $this->attendanceDeductions->execute($payroll);
        $payroll = $this->attendanceBonuses->execute($payroll);

        // ApplyAttendanceBonuses saves when bonuses/net change; always persist base/commission sync.
        if ($payroll->isDirty()) {
            $payroll->save();
        }
    }

    private function commissionTotal(int $employeeId, string $month): string
    {
        $total = Commission::query()
            ->where('employee_id', $employeeId)
            ->where('month', $month)
            ->where('status', 'pending')
            ->sum('amount');

        return $this->formatMoney($total);
    }

    private function formatMoney(mixed $value): string
    {
        return number_format((float) $value, 2, '.', '');
    }
}
