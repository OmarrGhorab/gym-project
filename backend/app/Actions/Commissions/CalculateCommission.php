<?php

namespace App\Actions\Commissions;

use App\Models\Commission;
use App\Models\Employee;
use App\Models\EmployeePlanCommissionRule;
use App\Models\Plan;
use App\Models\Sale;
use App\Models\Subscription;
use App\Models\SubscriptionAddon;
use App\Support\FoundationPermissions;
use App\Support\HrFinancePermissions;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\Log;

final class CalculateCommission
{
    /**
     * Default seller commission used when a plan has no configured commission_rate.
     */
    private const DEFAULT_SELLER_RATE = '0.0100';

    /**
     * Calculate and store commission for a given subscription or sale.
     */
    public function forSource(Subscription|Sale|SubscriptionAddon $source): int
    {
        $created = 0;

        foreach ($this->resolveSpecsForSource($source) as $spec) {
            $commission = Commission::firstOrCreate(
                [
                    'source_type' => get_class($source),
                    'source_id' => $source->id,
                    'employee_id' => $spec['employee']->id,
                    'commission_type' => $spec['commission_type'],
                ],
                [
                    'calculation_type' => $spec['calculation_type'],
                    'rate' => $spec['rate'],
                    'rule_value' => $spec['rule_value'],
                    'amount' => $spec['amount'],
                    'month' => $spec['month'],
                    'status' => 'pending',
                    'employee_plan_commission_rule_id' => $spec['rule_id'],
                ]
            );

            if ($commission->wasRecentlyCreated) {
                $created++;
            }
        }

        return $created;
    }

    /**
     * @return array<int, array{
     *   employee: Employee,
     *   commission_type: string,
     *   calculation_type: string,
     *   rate: string,
     *   rule_value: string|null,
     *   amount: string,
     *   month: string,
     *   rule_id: int|null
     * }>
     */
    public function resolveSpecsForSource(Subscription|Sale|SubscriptionAddon $source): array
    {
        if ($source instanceof Subscription) {
            return $this->resolveSubscriptionSpecs($source);
        }

        if ($source instanceof SubscriptionAddon) {
            return $this->resolveSubscriptionAddonSpecs($source);
        }

        if ($source instanceof Sale) {
            return $this->resolveSaleSpecs($source);
        }

        return [];
    }

    /**
     * @return array<int, array{
     *   employee: Employee,
     *   commission_type: string,
     *   calculation_type: string,
     *   rate: string,
     *   rule_value: string|null,
     *   amount: string,
     *   month: string,
     *   rule_id: int|null
     * }>
     */
    private function resolveSubscriptionSpecs(Subscription $subscription): array
    {
        $subscription->loadMissing(['plan', 'coach.planCommissionRules']);
        $specs = [];
        $month = $subscription->created_at ? $subscription->created_at->format('Y-m') : now()->format('Y-m');
        $base = (string) $subscription->price_paid;

        $salesEmployee = $this->resolveSalesEmployee($subscription->sold_by_user_id, $subscription);

        if ($salesEmployee !== null) {
            $user = $salesEmployee->user;
            $hasPermission = ! $user
                || $user->roles()->count() === 0
                || $user->hasPermissionTo(HrFinancePermissions::PERM_COMMISSIONS_EARN_SALES)
                || $user->hasRole(FoundationPermissions::ROLE_ADMIN);

            if ($hasPermission) {
                $rate = $this->resolveSellerRate($subscription->plan);
                $amount = bcmul($base, $rate, 2);

                if (bccomp($amount, '0.00', 2) > 0) {
                    $specs[] = [
                        'employee' => $salesEmployee,
                        'commission_type' => 'subscription_sale',
                        'calculation_type' => 'percentage',
                        'rate' => $rate,
                        'rule_value' => bcmul($rate, '100', 4),
                        'amount' => $amount,
                        'month' => $month,
                        'rule_id' => null,
                    ];
                }
            }
        }

        $coach = $subscription->coach;
        $coachRule = $this->resolveCoachRule($coach?->planCommissionRules, $subscription->plan_id);

        // Written even when the amount works out to zero, unlike the seller row
        // above. The rule is the coach's assignment to this plan, so the row is
        // what records that this member is theirs; a plan coached for nothing —
        // or one given away at a full discount — still belongs on their list.
        // Nothing is earned, so payroll totals are unaffected.
        if ($coach !== null && $coach->status === 'active' && $coachRule !== null) {
            $amount = $coachRule->calculation_type === 'percentage'
                ? bcmul($base, bcdiv((string) $coachRule->value, '100', 6), 2)
                : number_format((float) $coachRule->value, 2, '.', '');

            $specs[] = [
                'employee' => $coach,
                'commission_type' => 'subscription_coach',
                'calculation_type' => $coachRule->calculation_type,
                'rate' => $coachRule->calculation_type === 'percentage'
                    ? bcdiv((string) $coachRule->value, '100', 4)
                    : '0.0000',
                'rule_value' => (string) $coachRule->value,
                'amount' => $amount,
                'month' => $month,
                'rule_id' => $coachRule->id,
            ];
        }

        if ($specs === []) {
            Log::info("Skipping commission for source {$subscription->id} (type: ".Subscription::class.') - no eligible commission rules found.');
        }

        return $specs;
    }

    /**
     * @return array<int, array{
     *   employee: Employee,
     *   commission_type: string,
     *   calculation_type: string,
     *   rate: string,
     *   rule_value: string|null,
     *   amount: string,
     *   month: string,
     *   rule_id: int|null
     * }>
     */
    private function resolveSaleSpecs(Sale $sale): array
    {
        Log::info("Skipping commission for source {$sale->id} - POS sales do not have a commission plan.");

        return [];
    }

    /**
     * @return array<int, array{
     *   employee: Employee,
     *   commission_type: string,
     *   calculation_type: string,
     *   rate: string,
     *   rule_value: string|null,
     *   amount: string,
     *   month: string,
     *   rule_id: int|null
     * }>
     */
    private function resolveSubscriptionAddonSpecs(SubscriptionAddon $addon): array
    {
        $addon->loadMissing(['plan', 'subscription', 'coach.planCommissionRules']);
        $specs = [];
        $month = $addon->created_at ? $addon->created_at->format('Y-m') : now()->format('Y-m');
        $base = (string) $addon->price_paid;
        // Paid add-on: coach % of (membership + add-on). Bundled package include
        // (price_paid is 0): coach % of the included service list price only.
        $coachPercentageBase = bccomp($base, '0.00', 2) === 0
            ? number_format((float) ($addon->plan?->price ?? 0), 2, '.', '')
            : bcadd((string) ($addon->subscription?->price_paid ?? '0.00'), $base, 2);

        $salesEmployee = $this->resolveSalesEmployee($addon->sold_by_user_id, $addon);

        if ($salesEmployee !== null) {
            $user = $salesEmployee->user;
            $hasPermission = ! $user
                || $user->roles()->count() === 0
                || $user->hasPermissionTo(HrFinancePermissions::PERM_COMMISSIONS_EARN_SALES)
                || $user->hasRole(FoundationPermissions::ROLE_ADMIN);

            if ($hasPermission) {
                $rate = $this->resolveSellerRate($addon->plan);
                $amount = bcmul($base, $rate, 2);

                if (bccomp($amount, '0.00', 2) > 0) {
                    $specs[] = [
                        'employee' => $salesEmployee,
                        'commission_type' => 'subscription_addon_sale',
                        'calculation_type' => 'percentage',
                        'rate' => $rate,
                        'rule_value' => bcmul($rate, '100', 4),
                        'amount' => $amount,
                        'month' => $month,
                        'rule_id' => null,
                    ];
                }
            }
        }

        $coach = $addon->coach;
        $coachRule = $this->resolveCoachRule($coach?->planCommissionRules, $addon->plan_id);

        // As with the base subscription: a zero-value rule still assigns the
        // service to this coach, so the row is written and only the earning is nil.
        if ($coach !== null && $coach->status === 'active' && $coachRule !== null) {
            $amount = $coachRule->calculation_type === 'percentage'
                ? bcmul($coachPercentageBase, bcdiv((string) $coachRule->value, '100', 6), 2)
                : number_format((float) $coachRule->value, 2, '.', '');

            $specs[] = [
                'employee' => $coach,
                'commission_type' => 'subscription_addon_coach',
                'calculation_type' => $coachRule->calculation_type,
                'rate' => $coachRule->calculation_type === 'percentage'
                    ? bcdiv((string) $coachRule->value, '100', 4)
                    : '0.0000',
                'rule_value' => (string) $coachRule->value,
                'amount' => $amount,
                'month' => $month,
                'rule_id' => $coachRule->id,
            ];
        }

        if ($specs === []) {
            Log::info("Skipping commission for source {$addon->id} (type: ".SubscriptionAddon::class.') - no eligible commission rules found.');
        }

        return $specs;
    }

    /**
     * Seller (cashier / sales rep) rate for a subscription or add-on sale.
     *
     * Precedence:
     *  1. The plan's configured commission_rate (an explicit 0.0000 means "this plan pays no sales commission").
     *  2. When the plan has no configured rate at all, fall back to the default 1% of the sale.
     */
    private function resolveSellerRate(?Plan $plan): string
    {
        if ($plan !== null && $plan->commission_rate !== null) {
            return (string) $plan->commission_rate;
        }

        return self::DEFAULT_SELLER_RATE;
    }

    private function resolveSalesEmployee(?int $userId, Subscription|Sale|SubscriptionAddon $source): ?Employee
    {
        if (! $userId) {
            Log::info("Skipping commission for source {$source->id} (type: ".get_class($source).') - no sold_by_user_id.');

            return null;
        }

        $employee = Employee::with('user')->where('user_id', $userId)->first();

        if (! $employee) {
            Log::info("Skipping commission for source {$source->id} (type: ".get_class($source).") - user {$userId} is not linked to any employee.");

            return null;
        }

        if ($employee->status !== 'active') {
            Log::info("Skipping commission for source {$source->id} - employee {$employee->id} is inactive.");

            return null;
        }

        return $employee;
    }

    private function resolveCoachRule(?Collection $rules, int $planId): ?EmployeePlanCommissionRule
    {
        if ($rules === null) {
            return null;
        }

        /** @var EmployeePlanCommissionRule|null $planRule */
        $planRule = $rules
            ->where('is_active', true)
            ->firstWhere('plan_id', $planId);

        if ($planRule !== null) {
            return $planRule;
        }

        /** @var EmployeePlanCommissionRule|null $defaultRule */
        $defaultRule = $rules
            ->where('is_active', true)
            ->firstWhere('plan_id', null);

        return $defaultRule;
    }
}
