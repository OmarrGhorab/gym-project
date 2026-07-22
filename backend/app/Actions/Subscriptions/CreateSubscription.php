<?php

namespace App\Actions\Subscriptions;

use App\Actions\Payments\RecordPayment;
use App\Models\EmployeePlanCommissionRule;
use App\Models\Member;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\SubscriptionAddon;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CreateSubscription
{
    public function __construct(
        private readonly RecordPayment $recordPayment,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(array $data, User $seller): Subscription
    {
        $member = Member::query()->findOrFail($data['member_id']);
        $plan = Plan::query()->findOrFail($data['plan_id']);

        if ($member->status !== 'active') {
            throw ValidationException::withMessages([
                'member_id' => 'Only active members can receive subscriptions.',
            ]);
        }

        if (! $plan->isSellable()) {
            throw ValidationException::withMessages([
                'plan_id' => 'The selected plan is not currently sellable.',
            ]);
        }

        if ($plan->category !== 'gym_access') {
            throw ValidationException::withMessages([
                'plan_id' => 'The main subscription plan must be a base gym access plan.',
            ]);
        }

        return DB::transaction(function () use ($data, $seller, $member, $plan): Subscription {
            $startDate = Carbon::parse($data['start_date'])->startOfDay();
            $endDate = isset($data['end_date'])
                ? Carbon::parse($data['end_date'])->startOfDay()
                : $plan->endDateFrom($startDate);
            $cycles = $this->cycleCount($startDate, $endDate, $plan);
            $discount = number_format((float) ($data['discount'] ?? 0), 2, '.', '');
            $subtotal = bcmul((string) $plan->price, (string) $cycles, 2);
            $pricePaid = bcsub($subtotal, $discount, 2);
            $sessionAllowance = $plan->is_unlimited_sessions || $plan->sessions_count === null
                ? null
                : (int) $plan->sessions_count * $cycles;

            if (bccomp($pricePaid, '0.00', 2) === -1) {
                throw ValidationException::withMessages([
                    'discount' => 'Discount cannot exceed the subscription total.',
                ]);
            }

            $subscription = Subscription::create([
                'member_id' => $member->id,
                'plan_id' => $plan->id,
                'start_date' => $startDate->toDateString(),
                'end_date' => $endDate->toDateString(),
                'status' => 'active',
                'price_paid' => $pricePaid,
                'discount' => $discount,
                'cancellation_grace_days' => (int) ($plan->cancellation_grace_days ?? 2),
                'sessions_total' => $sessionAllowance,
                'sessions_remaining' => $sessionAllowance,
                'sold_by_user_id' => $seller->id,
                'created_by' => $seller->id,
            ]);

            if (bccomp($pricePaid, '0.00', 2) === 1) {
                $this->recordPayment->handle($subscription, $data['payment'], $seller);
            }

            foreach (($data['addons'] ?? []) as $addonData) {
                $addonPlan = Plan::query()->findOrFail($addonData['plan_id']);

                if (! $addonPlan->isSellable()) {
                    throw ValidationException::withMessages([
                        'addons' => 'One of the selected add-ons is not currently sellable.',
                    ]);
                }

                if ($addonPlan->category === 'gym_access') {
                    throw ValidationException::withMessages([
                        'addons' => 'Add-ons must be service plans, not base gym access plans.',
                    ]);
                }

                $addonCoachId = (int) ($addonData['coach_id'] ?? 0);

                if ($addonCoachId <= 0 || ! $this->coachCanSellAddon($addonPlan->id, $addonCoachId)) {
                    throw ValidationException::withMessages([
                        'addons' => 'The selected coach is not assigned to one of the selected add-on services.',
                    ]);
                }

                $addonEndDate = $addonPlan->endDateFrom($startDate);
                $addonDiscount = number_format((float) ($addonData['discount'] ?? 0), 2, '.', '');
                $addonPricePaid = bcsub((string) $addonPlan->price, $addonDiscount, 2);

                if (bccomp($addonPricePaid, '0.00', 2) === -1) {
                    throw ValidationException::withMessages([
                        'addons' => 'Add-on discount cannot exceed the add-on total.',
                    ]);
                }

                $addonSessionAllowance = $addonPlan->is_unlimited_sessions || $addonPlan->sessions_count === null
                    ? null
                    : (int) $addonPlan->sessions_count;

                $addon = SubscriptionAddon::create([
                    'subscription_id' => $subscription->id,
                    'member_id' => $member->id,
                    'plan_id' => $addonPlan->id,
                    'coach_id' => $addonCoachId,
                    'start_date' => $startDate->toDateString(),
                    'end_date' => $addonEndDate->toDateString(),
                    'status' => 'active',
                    'price_paid' => $addonPricePaid,
                    'discount' => $addonDiscount,
                    'sessions_total' => $addonSessionAllowance,
                    'sessions_remaining' => $addonSessionAllowance,
                    'sold_by_user_id' => $seller->id,
                    'created_by' => $seller->id,
                ]);

                if (bccomp($addonPricePaid, '0.00', 2) === 1) {
                    $this->recordPayment->handle($addon, $addonData['payment'], $seller);
                }
            }

            return $subscription->fresh(['member', 'plan', 'soldBy', 'payments', 'addons.plan', 'addons.coach', 'addons.payments']) ?? $subscription;
        });
    }

    private function cycleCount(Carbon $startDate, Carbon $endDate, Plan $plan): int
    {
        if ($endDate->lessThanOrEqualTo($startDate)) {
            return 1;
        }

        $durationMonths = (int) ($plan->duration_months ?? 0);

        if ($durationMonths > 0) {
            $cursor = $startDate->copy();
            $cycles = 0;

            while ($cursor->lt($endDate)) {
                $cursor->addMonthsNoOverflow($durationMonths);
                $cycles += 1;
            }

            return max(1, $cycles);
        }

        $durationDays = max(1, (int) $plan->duration_days);

        return max(1, (int) ceil($startDate->diffInDays($endDate) / $durationDays));
    }

    private function coachCanSellAddon(int $planId, int $coachId): bool
    {
        return EmployeePlanCommissionRule::query()
            ->where('plan_id', $planId)
            ->where('employee_id', $coachId)
            ->where('is_active', true)
            ->exists();
    }
}
