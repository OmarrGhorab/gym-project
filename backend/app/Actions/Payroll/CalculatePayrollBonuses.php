<?php

namespace App\Actions\Payroll;

use App\Models\Attendance;
use App\Models\AttendanceViolation;
use App\Models\Payroll;
use App\Models\SubscriptionAddon;
use App\Support\PayrollBonusPolicy;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Carbon;

final class CalculatePayrollBonuses
{
    public function __construct(private readonly PayrollBonusPolicy $policy) {}

    /**
     * @return array{
     *   off_day_rows: Collection<int, Attendance>,
     *   off_day_total: string,
     *   clean_attendance: string,
     *   clean_attendance_percentage: string,
     *   coach_performance: string,
     *   coach_performance_percentage: string,
     *   coached_addons: Collection<int, SubscriptionAddon>,
     *   total: string
     * }
     */
    public function execute(Payroll $payroll): array
    {
        return $this->calculate(
            $payroll,
            $this->policy->cleanAttendanceEnabled(),
            $this->policy->cleanAttendanceRate(),
            $this->policy->coachPerformanceEnabled(),
            $this->policy->coachPerformanceRate(),
        );
    }

    public function legacyTotal(Payroll $payroll): string
    {
        return $this->legacy($payroll)['total'];
    }

    /**
     * @return array{
     *   off_day_rows: Collection<int, Attendance>,
     *   off_day_total: string,
     *   clean_attendance: string,
     *   clean_attendance_percentage: string,
     *   coach_performance: string,
     *   coach_performance_percentage: string,
     *   coached_addons: Collection<int, SubscriptionAddon>,
     *   total: string
     * }
     */
    public function legacy(Payroll $payroll): array
    {
        return $this->calculate($payroll, true, '0.020000', true, '0.030000');
    }

    /**
     * @return array{
     *   off_day_rows: Collection<int, Attendance>,
     *   off_day_total: string,
     *   clean_attendance: string,
     *   clean_attendance_percentage: string,
     *   coach_performance: string,
     *   coach_performance_percentage: string,
     *   coached_addons: Collection<int, SubscriptionAddon>,
     *   total: string
     * }
     */
    private function calculate(
        Payroll $payroll,
        bool $cleanEnabled,
        string $cleanRate,
        bool $coachEnabled,
        string $coachRate,
    ): array {
        [$from, $to] = $this->monthRange($payroll);
        $attendance = Attendance::query()
            ->where('employee_id', $payroll->employee_id)
            ->whereBetween('date', [$from, $to])
            ->orderBy('date')
            ->get();
        $hasViolation = AttendanceViolation::query()
            ->where('employee_id', $payroll->employee_id)
            ->whereBetween('violation_date', [$from, $to])
            ->whereIn('status', ['approved', 'pending', 'auto_applied'])
            ->exists();
        $offDayRows = $attendance
            ->filter(fn (Attendance $row): bool => bccomp((string) $row->off_day_bonus_amount, '0.00', 2) === 1)
            ->values();
        $offDayTotal = $offDayRows->reduce(
            fn (string $total, Attendance $row): string => bcadd($total, (string) $row->off_day_bonus_amount, 2),
            '0.00',
        );
        $hasRegularAttendance = $attendance->contains(
            fn (Attendance $row): bool => in_array($row->status, ['present', 'late'], true)
                && $row->schedule_status !== 'off_day',
        );
        $cleanAttendance = $cleanEnabled && $hasRegularAttendance && ! $hasViolation
            ? bcmul((string) $payroll->base_salary, $cleanRate, 2)
            : '0.00';
        $coachedAddons = SubscriptionAddon::query()
            ->with(['member', 'plan'])
            ->where('coach_id', $payroll->employee_id)
            ->whereBetween('created_at', [
                Carbon::parse($from)->startOfDay(),
                Carbon::parse($to)->endOfDay(),
            ])
            ->orderBy('created_at')
            ->orderBy('id')
            ->get();
        $coachPerformance = $coachEnabled && $coachedAddons->isNotEmpty() && ! $hasViolation
            ? bcmul((string) $payroll->base_salary, $coachRate, 2)
            : '0.00';
        $total = bcadd($offDayTotal, $cleanAttendance, 2);
        $total = bcadd($total, $coachPerformance, 2);

        return [
            'off_day_rows' => $offDayRows,
            'off_day_total' => $offDayTotal,
            'clean_attendance' => $cleanAttendance,
            'clean_attendance_percentage' => bcmul($cleanRate, '100', 4),
            'coach_performance' => $coachPerformance,
            'coach_performance_percentage' => bcmul($coachRate, '100', 4),
            'coached_addons' => $coachedAddons,
            'total' => $total,
        ];
    }

    /** @return array{string, string} */
    private function monthRange(Payroll $payroll): array
    {
        $from = "{$payroll->month}-01";

        return [$from, Carbon::parse($from)->endOfMonth()->toDateString()];
    }
}
