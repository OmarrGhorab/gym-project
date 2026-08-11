<?php

namespace App\Actions\Payroll;

use App\Models\Payroll;
use Illuminate\Validation\ValidationException;

final class UpdatePayroll
{
    /**
     * Update bonuses and deductions for a pending payroll entry.
     *
     * Both start at zero on every generated payroll and only ever move because
     * an admin typed a figure in, so each non-zero amount must carry a reason.
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

        $bonuses = isset($data['bonuses'])
            ? number_format((float) $data['bonuses'], 2, '.', '')
            : (string) $payroll->bonuses;
        $deductions = isset($data['deductions'])
            ? number_format((float) $data['deductions'], 2, '.', '')
            : (string) $payroll->deductions;

        $bonusReason = trim((string) ($data['manual_bonus_reason'] ?? $payroll->manual_bonus_reason ?? ''));
        $deductionReason = trim((string) ($data['manual_deduction_reason'] ?? $payroll->manual_deduction_reason ?? ''));

        if (bccomp($bonuses, '0.00', 2) === 1 && $bonusReason === '') {
            throw ValidationException::withMessages([
                'manual_bonus_reason' => 'Add a reason for the bonus.',
            ]);
        }

        if (bccomp($deductions, '0.00', 2) === 1 && $deductionReason === '') {
            throw ValidationException::withMessages([
                'manual_deduction_reason' => 'Add a reason for the deduction.',
            ]);
        }

        $net = bcadd((string) $payroll->base_salary, (string) $payroll->commissions_total, 2);
        $net = bcadd($net, $bonuses, 2);
        $net = bcsub($net, $deductions, 2);

        if (bccomp($net, '0.00', 2) === -1) {
            throw ValidationException::withMessages([
                'deductions' => 'Net salary cannot be negative.',
            ]);
        }

        $payroll->update([
            'bonuses' => $bonuses,
            'deductions' => $deductions,
            'manual_bonus_reason' => bccomp($bonuses, '0.00', 2) === 1 ? $bonusReason : null,
            'manual_deduction_reason' => bccomp($deductions, '0.00', 2) === 1 ? $deductionReason : null,
            'net_salary' => $net,
        ]);

        return $payroll->fresh();
    }
}
