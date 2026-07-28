<?php

namespace App\Actions\Payroll;

use App\Models\Attendance;
use App\Models\AttendanceViolation;
use App\Models\Commission;
use App\Models\Payroll;
use App\Models\Subscription;
use App\Models\SubscriptionAddon;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

final class BuildPayslipBreakdown
{
    private const CLEAN_ATTENDANCE_BONUS_RATE = '0.0200';

    private const COACH_PERFORMANCE_BONUS_RATE = '0.0300';

    /**
     * @param  EloquentCollection<int, Commission>  $commissions
     * @param  EloquentCollection<int, Attendance>  $attendance
     * @param  EloquentCollection<int, AttendanceViolation>  $violations
     * @return array{commissions: Collection<int, array<string, mixed>>, bonuses: Collection<int, array<string, mixed>>}
     */
    public function execute(
        Payroll $payroll,
        EloquentCollection $commissions,
        EloquentCollection $attendance,
        EloquentCollection $violations,
    ): array {
        return [
            'commissions' => $this->commissionRows($payroll, $commissions),
            'bonuses' => $this->bonusRows($payroll, $attendance, $violations),
        ];
    }

    /**
     * @param  EloquentCollection<int, Commission>  $commissions
     * @return Collection<int, array<string, mixed>>
     */
    private function commissionRows(Payroll $payroll, EloquentCollection $commissions): Collection
    {
        $status = $payroll->status === 'paid' ? 'paid' : 'pending';

        return $commissions
            ->where('status', $status)
            ->values()
            ->map(function (Commission $commission): array {
                $source = $commission->source;
                $memberName = null;
                $planName = null;
                $sourceKind = 'Other';
                $sourceKindAr = 'أخرى';

                if ($source instanceof Subscription) {
                    $memberName = $source->member?->name;
                    $planName = $source->plan?->name;
                    $sourceKind = 'Membership';
                    $sourceKindAr = 'اشتراك';
                } elseif ($source instanceof SubscriptionAddon) {
                    $memberName = $source->member?->name ?? $source->subscription?->member?->name;
                    $planName = $source->plan?->name;
                    $sourceKind = 'Add-on';
                    $sourceKindAr = 'خدمة إضافية';
                }

                [$reason, $reasonAr] = $this->commissionReason($commission->commission_type);

                return [
                    'commission_id' => $commission->id,
                    'source_id' => $commission->source_id,
                    'source_kind' => $sourceKind,
                    'source_kind_ar' => $sourceKindAr,
                    'member_name' => $memberName ?? 'Member #'.$commission->source_id,
                    'plan_name' => $planName ?? '-',
                    'reason' => $reason,
                    'reason_ar' => $reasonAr,
                    'rate' => $this->commissionRate($commission),
                    'amount' => number_format((float) $commission->amount, 2, '.', ''),
                ];
            });
    }

    /**
     * @param  EloquentCollection<int, Attendance>  $attendance
     * @param  EloquentCollection<int, AttendanceViolation>  $violations
     * @return Collection<int, array<string, mixed>>
     */
    private function bonusRows(
        Payroll $payroll,
        EloquentCollection $attendance,
        EloquentCollection $violations,
    ): Collection {
        $rows = collect();
        $hasViolation = $violations->contains(
            fn (AttendanceViolation $violation): bool => in_array(
                $violation->status,
                ['approved', 'pending', 'auto_applied'],
                true,
            ),
        );

        foreach ($attendance->where('off_day_bonus_amount', '>', 0) as $row) {
            $date = $row->date?->toDateString() ?? '-';
            $rows->push([
                'type' => 'Off-day attendance',
                'type_ar' => 'حضور يوم إجازة',
                'details' => "Worked scheduled day off on {$date}",
                'details_ar' => "حضور يوم الإجازة بتاريخ {$date}",
                'amount' => number_format((float) $row->off_day_bonus_amount, 2, '.', ''),
            ]);
        }

        $hasRegularAttendance = $attendance->contains(
            fn (Attendance $row): bool => in_array($row->status, ['present', 'late'], true)
                && $row->schedule_status !== 'off_day',
        );

        if ($hasRegularAttendance && ! $hasViolation) {
            $amount = bcmul((string) $payroll->base_salary, self::CLEAN_ATTENDANCE_BONUS_RATE, 2);
            $rows->push([
                'type' => 'Clean attendance bonus',
                'type_ar' => 'مكافأة انتظام الحضور',
                'details' => 'No attendance violations (2% of base salary)',
                'details_ar' => 'لا توجد مخالفات حضور (2% من الراتب الأساسي)',
                'amount' => $amount,
            ]);
        }

        $coachedAddons = $this->coachedAddons($payroll);

        if ($coachedAddons->isNotEmpty() && ! $hasViolation) {
            $amount = bcmul((string) $payroll->base_salary, self::COACH_PERFORMANCE_BONUS_RATE, 2);

            $rows->push([
                'type' => 'Coach performance bonus',
                'type_ar' => 'مكافأة أداء المدرب',
                'details' => $coachedAddons->count().' coached add-on(s) this month (3% of base salary)',
                'details_ar' => $coachedAddons->count().' خدمة إضافية تم تدريبها هذا الشهر (3% من الراتب الأساسي)',
                'amount' => $amount,
            ]);
        }

        $explained = $rows->reduce(
            fn (string $total, array $row): string => bcadd($total, (string) $row['amount'], 2),
            '0.00',
        );
        $unexplained = bcsub((string) $payroll->bonuses, $explained, 2);

        if (bccomp($unexplained, '0.00', 2) !== 0) {
            $rows->push([
                'type' => $unexplained > 0 ? 'Manual management bonus' : 'Bonus reconciliation adjustment',
                'type_ar' => $unexplained > 0 ? 'مكافأة إدارية يدوية' : 'تسوية قيمة المكافآت',
                'details' => $unexplained > 0
                    ? 'Entered manually in payroll; no separate reason was recorded'
                    : 'Keeps the itemized breakdown equal to the saved payroll total',
                'details_ar' => $unexplained > 0
                    ? 'تم إدخالها يدويا في المرتب ولم يسجل سبب منفصل'
                    : 'تسوية ليتطابق التفصيل مع إجمالي المكافآت المحفوظ',
                'amount' => $unexplained,
            ]);
        }

        return $rows;
    }

    /** @return EloquentCollection<int, SubscriptionAddon> */
    private function coachedAddons(Payroll $payroll): EloquentCollection
    {
        $from = Carbon::parse("{$payroll->month}-01")->startOfDay();
        $to = $from->copy()->endOfMonth()->endOfDay();

        return SubscriptionAddon::query()
            ->with(['member', 'plan'])
            ->where('coach_id', $payroll->employee_id)
            ->whereBetween('created_at', [$from, $to])
            ->orderBy('created_at')
            ->orderBy('id')
            ->get();
    }

    /** @return array{string, string} */
    private function commissionReason(string $type): array
    {
        return match ($type) {
            'subscription_sale' => ['Membership sale', 'بيع اشتراك'],
            'subscription_coach' => ['Membership coaching', 'تدريب اشتراك'],
            'subscription_addon_sale' => ['Add-on sale', 'بيع خدمة إضافية'],
            'subscription_addon_coach' => ['Add-on coaching', 'تدريب خدمة إضافية'],
            'subscription_sale_refund' => ['Membership refund reversal', 'عكس عمولة استرداد اشتراك'],
            'subscription_coach_refund' => ['Membership coaching refund', 'عكس عمولة تدريب اشتراك'],
            'subscription_addon_sale_refund' => ['Add-on refund reversal', 'عكس عمولة بيع خدمة إضافية'],
            'subscription_addon_coach_refund' => ['Add-on coaching refund', 'عكس عمولة تدريب خدمة إضافية'],
            default => [str_replace('_', ' ', ucfirst($type)), str_replace('_', ' ', $type)],
        };
    }

    private function commissionRate(Commission $commission): string
    {
        if ($commission->calculation_type === 'fixed') {
            return 'Fixed';
        }

        $percentage = $commission->rule_value !== null
            ? (float) $commission->rule_value
            : (float) $commission->rate * 100;

        return rtrim(rtrim(number_format($percentage, 2, '.', ''), '0'), '.').'%';
    }
}
