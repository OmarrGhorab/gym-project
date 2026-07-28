<?php

namespace App\Actions\Payroll;

use App\Models\AttendanceViolation;
use App\Models\Payroll;
use App\Services\OperationalNotifier;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

final class ApplyAttendanceDeductions
{
    public function __construct(
        private readonly OperationalNotifier $notifier,
    ) {}

    public function execute(Payroll $payroll): Payroll
    {
        $violations = AttendanceViolation::query()
            ->with('rule')
            ->where('employee_id', $payroll->employee_id)
            ->whereBetween('violation_date', [
                "{$payroll->month}-01",
                Carbon::parse("{$payroll->month}-01")->endOfMonth()->toDateString(),
            ])
            ->where(function ($query): void {
                $query->where('status', 'approved')
                    ->orWhere('status', 'pending')
                    ->orWhere('status', 'auto_applied');
            })
            ->get();

        $applicable = $violations->filter(function (AttendanceViolation $violation): bool {
            return $violation->status === 'approved'
                || (bool) $violation->rule?->auto_apply_if_unreviewed;
        });

        $dailySalary = bcdiv((string) $payroll->base_salary, '30', 2);
        $total = '0.00';

        foreach ($applicable as $violation) {
            $amount = bcmul($dailySalary, (string) $violation->deduction_days, 2);
            $originalAmount = (string) $violation->deduction_amount;
            $originalStatus = (string) $violation->status;
            $updates = [
                'deduction_amount' => $amount,
                'status' => $violation->status === 'pending' ? 'auto_applied' : $violation->status,
            ];

            if ($payroll->exists) {
                $updates['payroll_id'] = $payroll->id;
            }

            $violation->update($updates);
            $violation->deduction_amount = $amount;
            $violation->status = $updates['status'];

            if (
                bccomp($amount, '0.00', 2) === 1
                && (bccomp($originalAmount, $amount, 2) !== 0 || $originalStatus !== $updates['status'])
            ) {
                $this->notifier->employeeAttendanceDeduction($violation);
            }

            $total = bcadd($total, $amount, 2);
        }

        $payroll->attendance_deductions = $total;
        $snapshot = $this->snapshot($applicable, $total);
        $existingBonusSnapshot = $payroll->attendance_snapshot['bonuses'] ?? null;
        if (is_array($existingBonusSnapshot)) {
            $snapshot['bonuses'] = $existingBonusSnapshot;
        }
        $payroll->attendance_snapshot = $snapshot;

        return $payroll;
    }

    /**
     * @param  Collection<int, AttendanceViolation>  $violations
     */
    private function snapshot(Collection $violations, string $total): array
    {
        return [
            'total' => $total,
            'violations' => $violations->map(fn (AttendanceViolation $violation) => [
                'id' => $violation->id,
                'date' => $violation->violation_date?->toDateString(),
                'type' => $violation->type,
                'minutes' => $violation->minutes,
                'deduction_days' => number_format((float) $violation->deduction_days, 2, '.', ''),
                'deduction_amount' => number_format((float) $violation->deduction_amount, 2, '.', ''),
                'status' => $violation->status,
                'notes' => $violation->notes,
            ])->values()->all(),
        ];
    }
}
