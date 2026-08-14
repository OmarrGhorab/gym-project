<?php

namespace App\Actions\EmployeeAbsences;

use App\Actions\Payroll\GeneratePayroll;
use App\Models\Attendance;
use App\Models\Employee;
use App\Models\Payroll;
use App\Models\User;

final class StoreEmployeeAbsence
{
    public function __construct(private readonly GeneratePayroll $payrollGenerator) {}

    /** @param array<string, mixed> $data */
    public function handle(array $data, User $admin): Attendance
    {
        $employee = Employee::query()->findOrFail($data['employee_id']);
        $reason = trim((string) $data['reason']);

        $absence = Attendance::query()->create([
            'employee_id' => $employee->id,
            'shift_id' => $employee->shift_id,
            'date' => $data['date'],
            'check_in' => null,
            'check_out' => null,
            'status' => 'absent',
            'scan_method' => 'manual',
            'notes' => $reason,
            'absence_reason' => $reason,
            'absence_deduction_amount' => $this->money($data['deduction_amount'] ?? 0),
            'absence_recorded_by' => $admin->id,
        ]);

        $this->refreshPendingPayroll($employee->id, substr((string) $data['date'], 0, 7));

        return $absence->load(['employee', 'absenceRecorder']);
    }

    private function refreshPendingPayroll(int $employeeId, string $month): void
    {
        $payroll = Payroll::query()
            ->where('employee_id', $employeeId)
            ->where('month', $month)
            ->where('status', 'pending')
            ->first();

        if ($payroll) {
            $this->payrollGenerator->refreshPendingPayroll($payroll);
        }
    }

    private function money(mixed $value): string
    {
        return number_format((float) $value, 2, '.', '');
    }
}
