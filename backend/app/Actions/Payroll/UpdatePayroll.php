<?php

namespace App\Actions\Payroll;

use App\Models\Payroll;
use Illuminate\Validation\ValidationException;

final class UpdatePayroll
{
    public function __construct(
        private readonly ApplyAttendanceDeductions $attendanceDeductions,
        private readonly ApplyAttendanceBonuses $attendanceBonuses,
    ) {}

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

        $payroll = $this->attendanceBonuses->execute($payroll);
        $automaticBonuses = (string) ($payroll->attendance_snapshot['bonuses']['automatic_total'] ?? '0.00');
        $requestedBonuses = isset($data['bonuses'])
            ? number_format((float) $data['bonuses'], 2, '.', '')
            : (string) $payroll->bonuses;
        if (bccomp($requestedBonuses, $automaticBonuses, 2) === -1) {
            throw ValidationException::withMessages([
                'bonuses' => "Bonus cannot be lower than the automatic bonus ({$automaticBonuses}). Disable or reduce the automatic rule in Settings first.",
            ]);
        }
        $manualBonuses = bcsub($requestedBonuses, $automaticBonuses, 2);
        $manualBonusReason = trim((string) ($data['manual_bonus_reason'] ?? ''));
        if (bccomp($manualBonuses, '0.00', 2) === 1 && $manualBonusReason === '') {
            throw ValidationException::withMessages([
                'manual_bonus_reason' => 'Add a reason for the manual bonus.',
            ]);
        }

        $payroll = $this->attendanceBonuses->execute($payroll, $manualBonuses);
        $bonuses = (string) $payroll->bonuses;
        $deductions = isset($data['deductions']) ? number_format((float) $data['deductions'], 2, '.', '') : (string) $payroll->deductions;
        $manualDeductionReason = trim((string) ($data['manual_deduction_reason'] ?? ''));
        if (bccomp($deductions, '0.00', 2) === 1 && $manualDeductionReason === '') {
            throw ValidationException::withMessages([
                'manual_deduction_reason' => 'Add a reason for the manual deduction.',
            ]);
        }

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

        $snapshot = $payroll->attendance_snapshot ?? [];
        if (bccomp($manualBonuses, '0.00', 2) === 1) {
            $snapshot['manual_bonus_reason'] = $manualBonusReason;
        } else {
            unset($snapshot['manual_bonus_reason']);
        }
        if (bccomp($deductions, '0.00', 2) === 1) {
            $snapshot['manual_deduction_reason'] = $manualDeductionReason;
        } else {
            unset($snapshot['manual_deduction_reason']);
        }

        $payroll->update([
            'bonuses' => $bonuses,
            'deductions' => $deductions,
            'attendance_deductions' => $attendanceDeductions,
            'attendance_snapshot' => $snapshot,
            'net_salary' => $net,
        ]);

        return $payroll->fresh();
    }
}
