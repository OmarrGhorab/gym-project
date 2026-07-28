<?php

namespace App\Actions\Payroll;

use App\Models\Commission;
use App\Models\Payroll;
use App\Models\Subscription;
use App\Models\SubscriptionAddon;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Collection;

final class BuildPayslipBreakdown
{
    public function __construct(private readonly CalculatePayrollBonuses $bonusCalculator) {}

    /**
     * @param  EloquentCollection<int, Commission>  $commissions
     * @return array{commissions: Collection<int, array<string, mixed>>, bonuses: Collection<int, array<string, mixed>>}
     */
    public function execute(
        Payroll $payroll,
        EloquentCollection $commissions,
    ): array {
        return [
            'commissions' => $this->commissionRows($payroll, $commissions),
            'bonuses' => $this->bonusRows($payroll),
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

    /** @return Collection<int, array<string, mixed>> */
    private function bonusRows(Payroll $payroll): Collection
    {
        $rows = collect();
        $saved = $payroll->attendance_snapshot['bonuses'] ?? null;
        $components = $payroll->status === 'paid' && ! is_array($saved)
            ? $this->bonusCalculator->legacy($payroll)
            : $this->bonusCalculator->execute($payroll);
        $saved = is_array($saved) ? $saved : [];

        foreach ($components['off_day_rows'] as $row) {
            $date = $row->date?->toDateString() ?? '-';
            $rows->push([
                'type' => 'Off-day attendance',
                'type_ar' => 'حضور يوم إجازة',
                'details' => "Worked scheduled day off on {$date}",
                'details_ar' => "حضور يوم الإجازة بتاريخ {$date}",
                'amount' => number_format((float) $row->off_day_bonus_amount, 2, '.', ''),
            ]);
        }

        $cleanAmount = (string) ($saved['clean_attendance'] ?? $components['clean_attendance']);
        $cleanPercentage = $this->percentageLabel(
            (string) ($saved['clean_attendance_percentage'] ?? $components['clean_attendance_percentage']),
        );
        if (bccomp($cleanAmount, '0.00', 2) === 1) {
            $rows->push([
                'type' => 'Clean attendance bonus',
                'type_ar' => 'مكافأة انتظام الحضور',
                'details' => "No attendance violations ({$cleanPercentage} of base salary)",
                'details_ar' => "لا توجد مخالفات حضور ({$cleanPercentage} من الراتب الأساسي)",
                'amount' => $cleanAmount,
            ]);
        }

        $coachAmount = (string) ($saved['coach_performance'] ?? $components['coach_performance']);
        $coachPercentage = $this->percentageLabel(
            (string) ($saved['coach_performance_percentage'] ?? $components['coach_performance_percentage']),
        );
        $coachedAddonsCount = (int) ($saved['coached_addons_count'] ?? $components['coached_addons']->count());
        if (bccomp($coachAmount, '0.00', 2) === 1) {
            $rows->push([
                'type' => 'Coach performance bonus',
                'type_ar' => 'مكافأة أداء المدرب',
                'details' => "{$coachedAddonsCount} coached add-on(s) this month ({$coachPercentage} of base salary)",
                'details_ar' => "{$coachedAddonsCount} خدمة إضافية تم تدريبها هذا الشهر ({$coachPercentage} من الراتب الأساسي)",
                'amount' => $coachAmount,
            ]);
        }

        $manual = array_key_exists('manual_total', $saved)
            ? (string) $saved['manual_total']
            : bcsub((string) $payroll->bonuses, $components['total'], 2);

        if (bccomp($manual, '0.00', 2) === 1) {
            $rows->push([
                'type' => 'Manual management bonus',
                'type_ar' => 'مكافأة إدارية يدوية',
                'details' => 'Entered manually in payroll; no separate reason was recorded',
                'details_ar' => 'تم إدخالها يدويا في المرتب ولم يسجل سبب منفصل',
                'amount' => $manual,
            ]);
        }

        return $rows;
    }

    private function percentageLabel(string $percentage): string
    {
        return rtrim(rtrim(number_format((float) $percentage, 2, '.', ''), '0'), '.').'%';
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
