<?php

namespace App\Actions\Payroll;

use App\Models\Payroll;
use Illuminate\Validation\ValidationException;

final class UpdatePayroll
{
    public function __construct(private readonly ApplyAttendanceDeductions $attendanceDeductions) {}

    /**
     * Update bonuses and deductions for a pending payroll entry.
     *
     * @param  array<string, mixed>  $data
     */
    public function execute(Payroll $payroll, array $data): Payroll
    {
        if ($payroll->status !== 'pending') {
            throw ValidationException::withMessages([
                'status' => 'Only pending payrolls can be adjusted.',
            ]);
        }

        $bonuses = isset($data['bonuses']) ? number_format((float) $data['bonuses'], 2, '.', '') : (string) $payroll->bonuses;
        $deductions = isset($data['deductions']) ? number_format((float) $data['deductions'], 2, '.', '') : (string) $payroll->deductions;
        $attendanceDeductions = isset($data['attendance_deductions'])
            ? number_format((float) $data['attendance_deductions'], 2, '.', '')
            : (string) $this->attendanceDeductions->execute($payroll)->attendance_deductions;

        $net = bcadd((string) $payroll->base_salary, (string) $payroll->commissions_total, 2);
        $net = bcadd($net, $bonuses, 2);
        $net = bcsub($net, $deductions, 2);
        $net = bcsub($net, $attendanceDeductions, 2);

        if (bccomp($net, '0.00', 2) === -1) {
            throw ValidationException::withMessages([
                'deductions' => 'Net salary cannot be negative.',
            ]);
        }

        $payroll->update([
            'bonuses' => $bonuses,
            'deductions' => $deductions,
            'attendance_deductions' => $attendanceDeductions,
            'attendance_snapshot' => $payroll->attendance_snapshot,
            'net_salary' => $net,
        ]);

        return $payroll->fresh();
    }
}
