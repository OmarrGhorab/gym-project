<?php

namespace App\Actions\Payroll;

use App\Models\Attendance;
use App\Models\AttendanceViolation;
use App\Models\Payroll;
use App\Models\SubscriptionAddon;
use Illuminate\Support\Carbon;

final class ApplyAttendanceBonuses
{
    private const CLEAN_ATTENDANCE_BONUS_RATE = '0.0200';
    private const COACH_PERFORMANCE_BONUS_RATE = '0.0300';
    private const COACH_PERFORMANCE_MIN_ADDONS = 1;

    public function execute(Payroll $payroll): Payroll
    {
        $automaticBonusTotal = $this->automaticBonusTotal($payroll);

        if (bccomp((string) $payroll->bonuses, $automaticBonusTotal, 2) === -1) {
            $payroll->bonuses = $automaticBonusTotal;
        }

        $netSalary = bcadd((string) $payroll->base_salary, (string) $payroll->commissions_total, 2);
        $netSalary = bcadd($netSalary, (string) $payroll->bonuses, 2);
        $netSalary = bcsub($netSalary, (string) $payroll->deductions, 2);
        $netSalary = bcsub($netSalary, (string) $payroll->attendance_deductions, 2);

        $payroll->net_salary = $netSalary;

        if ($payroll->exists && $payroll->isDirty(['bonuses', 'net_salary'])) {
            $payroll->save();
        }

        return $payroll;
    }

    private function automaticBonusTotal(Payroll $payroll): string
    {
        $total = $this->offDayBonusTotal($payroll);
        $total = bcadd($total, $this->cleanAttendanceBonus($payroll), 2);
        $total = bcadd($total, $this->coachPerformanceBonus($payroll), 2);

        return $total;
    }

    private function offDayBonusTotal(Payroll $payroll): string
    {
        $from = "{$payroll->month}-01";
        $to = Carbon::parse($from)->endOfMonth()->toDateString();
        $total = Attendance::query()
            ->where('employee_id', $payroll->employee_id)
            ->whereBetween('date', [$from, $to])
            ->sum('off_day_bonus_amount');

        return number_format((float) $total, 2, '.', '');
    }

    private function cleanAttendanceBonus(Payroll $payroll): string
    {
        if (! $this->hasAttendanceInMonth($payroll) || $this->hasViolationInMonth($payroll)) {
            return '0.00';
        }

        return bcmul((string) $payroll->base_salary, self::CLEAN_ATTENDANCE_BONUS_RATE, 2);
    }

    private function coachPerformanceBonus(Payroll $payroll): string
    {
        if ($this->hasViolationInMonth($payroll) || $this->coachedAddonsCount($payroll) < self::COACH_PERFORMANCE_MIN_ADDONS) {
            return '0.00';
        }

        return bcmul((string) $payroll->base_salary, self::COACH_PERFORMANCE_BONUS_RATE, 2);
    }

    private function hasAttendanceInMonth(Payroll $payroll): bool
    {
        [$from, $to] = $this->monthRange($payroll);

        return Attendance::query()
            ->where('employee_id', $payroll->employee_id)
            ->whereBetween('date', [$from, $to])
            ->whereIn('status', ['present', 'late'])
            ->where(function ($query): void {
                $query->whereNull('schedule_status')
                    ->orWhere('schedule_status', '!=', 'off_day');
            })
            ->exists();
    }

    private function hasViolationInMonth(Payroll $payroll): bool
    {
        [$from, $to] = $this->monthRange($payroll);

        return AttendanceViolation::query()
            ->where('employee_id', $payroll->employee_id)
            ->whereBetween('violation_date', [$from, $to])
            ->whereIn('status', ['approved', 'pending', 'auto_applied'])
            ->exists();
    }

    private function coachedAddonsCount(Payroll $payroll): int
    {
        [$from, $to] = $this->monthDateTimeRange($payroll);

        return SubscriptionAddon::query()
            ->where('coach_id', $payroll->employee_id)
            ->whereBetween('created_at', [$from, $to])
            ->count();
    }

    /** @return array{string, string} */
    private function monthRange(Payroll $payroll): array
    {
        $from = "{$payroll->month}-01";

        return [$from, Carbon::parse($from)->endOfMonth()->toDateString()];
    }

    /** @return array{string, string} */
    private function monthDateTimeRange(Payroll $payroll): array
    {
        [$from, $to] = $this->monthRange($payroll);

        return [
            Carbon::parse($from)->startOfDay()->toDateTimeString(),
            Carbon::parse($to)->endOfDay()->toDateTimeString(),
        ];
    }
}
