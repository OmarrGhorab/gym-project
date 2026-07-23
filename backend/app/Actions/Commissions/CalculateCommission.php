<?php

namespace App\Actions\Commissions;

use App\Models\Commission;
use App\Models\Employee;
use App\Models\EmployeePlanCommissionRule;
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
        $subscription->loadMissing(['plan']);
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
                $plan = $subscription->plan;
                $rate = $plan && $plan->commission_rate !== null && bccomp((string) $plan->commission_rate, '0.0000', 4) > 0
                    ? (string) $plan->commission_rate
                    : '0.0100'; // Default 1% commission on subscription creation, renewal, or plan change

                if (bccomp($rate, '0.0000', 4) > 0) {
                    $specs[] = [
                        'employee' => $salesEmployee,
                        'commission_type' => 'subscription_sale',
                        'calculation_type' => 'percentage',
                        'rate' => $rate,
                        'rule_value' => bcmul($rate, '100', 4),
                        'amount' => bcmul($base, $rate, 2),
                        'month' => $month,
                        'rule_id' => null,
                    ];
                }
            }
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
        $coachPercentageBase = bcadd((string) ($addon->subscription?->price_paid ?? '0.00'), $base, 2);

        $salesEmployee = $this->resolveSalesEmployee($addon->sold_by_user_id, $addon);

        if ($salesEmployee !== null) {
            $user = $salesEmployee->user;
            $hasPermission = ! $user
                || $user->roles()->count() === 0
                || $user->hasPermissionTo(HrFinancePermissions::PERM_COMMISSIONS_EARN_SALES)
                || $user->hasRole(FoundationPermissions::ROLE_ADMIN);

            if ($hasPermission) {
                $plan = $addon->plan;
                $rate = $plan && $plan->commission_rate !== null && bccomp((string) $plan->commission_rate, '0.0000', 4) > 0
                    ? (string) $plan->commission_rate
                    : '0.0100';

                if (bccomp($rate, '0.0000', 4) > 0) {
                    $specs[] = [
                        'employee' => $salesEmployee,
                        'commission_type' => 'subscription_addon_sale',
                        'calculation_type' => 'percentage',
                        'rate' => $rate,
                        'rule_value' => bcmul($rate, '100', 4),
                        'amount' => bcmul($base, $rate, 2),
                        'month' => $month,
                        'rule_id' => null,
                    ];
                }
            }
        }

        $coach = $addon->coach;
        $coachRule = $this->resolveCoachRule($coach?->planCommissionRules, $addon->plan_id);

        if ($coach !== null && $coach->status === 'active' && $coachRule !== null) {
            $amount = $coachRule->calculation_type === 'percentage'
                ? bcmul($coachPercentageBase, bcdiv((string) $coachRule->value, '100', 6), 2)
                : number_format((float) $coachRule->value, 2, '.', '');

            if (bccomp($amount, '0.00', 2) > 0) {
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
        }

        if ($specs === []) {
            Log::info("Skipping commission for source {$addon->id} (type: ".SubscriptionAddon::class.') - no eligible commission rules found.');
        }

        return $specs;
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
