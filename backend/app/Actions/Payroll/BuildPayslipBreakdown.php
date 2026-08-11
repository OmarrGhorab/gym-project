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

    /**
     * The only bonus a payslip can carry is the one an admin typed in, so the
     * breakdown is a single row that echoes the reason they recorded with it.
     *
     * @return Collection<int, array<string, mixed>>
     */
    private function bonusRows(Payroll $payroll): Collection
    {
        $rows = collect();
        $bonuses = number_format((float) $payroll->bonuses, 2, '.', '');

        if (bccomp($bonuses, '0.00', 2) !== 1) {
            return $rows;
        }

        $reason = trim((string) ($payroll->manual_bonus_reason ?? ''));
        $isArabicReason = $this->containsArabic($reason);

        $rows->push([
            'type' => 'Management bonus',
            'type_ar' => 'مكافأة إدارية',
            'details' => $reason === '' || ! $isArabicReason
                ? ($reason !== '' ? $reason : 'Entered manually in payroll; no separate reason was recorded')
                : '',
            'details_ar' => $reason === '' || $isArabicReason
                ? ($reason !== '' ? $reason : 'تم إدخالها يدويا في المرتب ولم يسجل سبب منفصل')
                : '',
            'amount' => $bonuses,
        ]);

        return $rows;
    }

    private function containsArabic(string $text): bool
    {
        return preg_match('/[\p{Arabic}]/u', $text) === 1;
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
