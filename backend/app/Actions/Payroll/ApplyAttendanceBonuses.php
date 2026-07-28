<?php

namespace App\Actions\Payroll;

use App\Models\Payroll;

final class ApplyAttendanceBonuses
{
    public function __construct(private readonly CalculatePayrollBonuses $calculator) {}

    public function execute(Payroll $payroll, ?string $manualBonusOverride = null): Payroll
    {
        $components = $this->calculator->execute($payroll);
        $snapshot = $payroll->attendance_snapshot ?? [];
        $savedBonusSnapshot = is_array($snapshot['bonuses'] ?? null) ? $snapshot['bonuses'] : [];
        $manualBonus = $manualBonusOverride ?? $this->manualBonus($payroll, $savedBonusSnapshot);
        $payroll->bonuses = bcadd($components['total'], $manualBonus, 2);
        $snapshot['bonuses'] = [
            'automatic_total' => $components['total'],
            'manual_total' => $manualBonus,
            'off_day_total' => $components['off_day_total'],
            'clean_attendance' => $components['clean_attendance'],
            'clean_attendance_percentage' => $components['clean_attendance_percentage'],
            'coach_performance' => $components['coach_performance'],
            'coach_performance_percentage' => $components['coach_performance_percentage'],
            'coached_addons_count' => $components['coached_addons']->count(),
        ];
        $payroll->attendance_snapshot = $snapshot;

        $netSalary = bcadd((string) $payroll->base_salary, (string) $payroll->commissions_total, 2);
        $netSalary = bcadd($netSalary, (string) $payroll->bonuses, 2);
        $netSalary = bcsub($netSalary, (string) $payroll->deductions, 2);
        $netSalary = bcsub($netSalary, (string) $payroll->attendance_deductions, 2);

        $payroll->net_salary = $netSalary;

        if ($payroll->exists && $payroll->isDirty(['bonuses', 'attendance_snapshot', 'net_salary'])) {
            $payroll->save();
        }

        return $payroll;
    }

    /** @param array<string, mixed> $savedBonusSnapshot */
    private function manualBonus(Payroll $payroll, array $savedBonusSnapshot): string
    {
        if (array_key_exists('manual_total', $savedBonusSnapshot)) {
            return number_format((float) $savedBonusSnapshot['manual_total'], 2, '.', '');
        }

        // Legacy payroll stored automatic and manual bonuses in one field.
        // Infer the old automatic portion once, then persist the split in the
        // snapshot so future setting changes never erase a manual adjustment.
        $legacyAutomatic = $this->calculator->legacyTotal($payroll);
        $legacyAutomatic = bccomp($legacyAutomatic, (string) $payroll->bonuses, 2) === 1
            ? (string) $payroll->bonuses
            : $legacyAutomatic;
        $manual = bcsub((string) $payroll->bonuses, $legacyAutomatic, 2);

        return bccomp($manual, '0.00', 2) === -1 ? '0.00' : $manual;
    }
}
