<?php

namespace App\Actions\EmployeeAbsences;

use App\Actions\Payroll\GeneratePayroll;
use App\Models\Attendance;
use App\Models\Payroll;

final class DeleteEmployeeAbsence
{
    public function __construct(private readonly GeneratePayroll $payrollGenerator) {}

    public function handle(Attendance $absence): void
    {
        $employeeId = (int) $absence->employee_id;
        $month = $absence->date?->format('Y-m');

        $absence->delete();

        if (! $month) {
            return;
        }

        $payroll = Payroll::query()
            ->where('employee_id', $employeeId)
            ->where('month', $month)
            ->where('status', 'pending')
            ->first();

        if ($payroll) {
            $this->payrollGenerator->refreshPendingPayroll($payroll);
        }
    }
}
