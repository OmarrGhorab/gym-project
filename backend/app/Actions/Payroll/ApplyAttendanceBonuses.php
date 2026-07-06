<?php

namespace App\Actions\Payroll;

use App\Models\Attendance;
use App\Models\Payroll;
use Illuminate\Support\Carbon;

final class ApplyAttendanceBonuses
{
    public function execute(Payroll $payroll): Payroll
    {
        $offDayBonusTotal = $this->offDayBonusTotal($payroll);

        if (bccomp((string) $payroll->bonuses, $offDayBonusTotal, 2) === -1) {
            $payroll->bonuses = $offDayBonusTotal;
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
}
