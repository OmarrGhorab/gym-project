<?php

namespace App\Actions\Subscriptions;

use App\Actions\Payments\RecordPayment;
use App\Models\Employee;
use App\Models\EmployeePlanCommissionRule;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\SubscriptionAddon;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AddSubscriptionAddon
{
    public function __construct(
        private readonly RecordPayment $recordPayment,
    ) {}

    /**
     * Attach a service/extra plan to an existing active membership (not gym_access).
     *
     * @param  array<string, mixed>  $data
     */
    public function handle(Subscription $subscription, array $data, User $seller): Subscription
    {
        return DB::transaction(function () use ($subscription, $data, $seller): Subscription {
            $locked = Subscription::query()
                ->lockForUpdate()
                ->with(['member', 'plan'])
                ->findOrFail($subscription->id);

            if ($locked->status !== 'active') {
                throw ValidationException::withMessages([
                    'subscription' => 'Extras can only be added to an active membership.',
                ]);
            }

            $addonPlan = Plan::query()->findOrFail($data['plan_id']);

            if (! $addonPlan->isSellable()) {
                throw ValidationException::withMessages([
                    'plan_id' => 'The selected extra plan is not currently sellable.',
                ]);
            }

            if ($addonPlan->category === 'gym_access') {
                throw ValidationException::withMessages([
                    'plan_id' => 'Use Change main plan for gym access memberships. This action is for extra services only.',
                ]);
            }

            $coachId = (int) ($data['coach_id'] ?? 0);
            $this->assertCoachAllowed($addonPlan->id, $coachId);

            $startDate = isset($data['start_date'])
                ? Carbon::parse($data['start_date'])->startOfDay()
                : Carbon::today();
            $endDate = $addonPlan->endDateFrom($startDate);
            $discount = number_format((float) ($data['discount'] ?? 0), 2, '.', '');
            $pricePaid = bcsub((string) $addonPlan->price, $discount, 2);

            if (bccomp($pricePaid, '0.00', 2) === -1) {
                throw ValidationException::withMessages([
                    'discount' => 'Discount cannot exceed the extra plan total.',
                ]);
            }

            $sessionAllowance = $addonPlan->is_unlimited_sessions || $addonPlan->sessions_count === null
                ? null
                : (int) $addonPlan->sessions_count;

            $addon = SubscriptionAddon::query()->create([
                'subscription_id' => $locked->id,
                'member_id' => $locked->member_id,
                'plan_id' => $addonPlan->id,
                'coach_id' => $coachId > 0 ? $coachId : null,
                'start_date' => $startDate->toDateString(),
                'end_date' => $endDate->toDateString(),
                'status' => 'active',
                'price_paid' => $pricePaid,
                'discount' => $discount,
                'sessions_total' => $sessionAllowance,
                'sessions_remaining' => $sessionAllowance,
                'sold_by_user_id' => $seller->id,
                'created_by' => $seller->id,
            ]);

            $paymentAmount = bcadd((string) ($data['payment']['amount'] ?? $pricePaid), '0.00', 2);

            if (bccomp($paymentAmount, '0.00', 2) === 1) {
                $this->recordPayment->handle($addon, [
                    'amount' => $paymentAmount,
                    'method' => $data['payment']['method'] ?? 'cash',
                    'paid_at' => $data['payment']['paid_at'] ?? null,
                ], $seller);
            }

            return $locked->fresh([
                'member', 'plan', 'soldBy', 'payments', 'freezes', 'refunds',
                'addons.plan', 'addons.coach', 'addons.payments',
            ]);
        });
    }

    private function assertCoachAllowed(int $planId, int $coachId): void
    {
        $hasRules = EmployeePlanCommissionRule::query()
            ->where('plan_id', $planId)
            ->where('is_active', true)
            ->exists();

        if ($hasRules) {
            if ($coachId <= 0) {
                throw ValidationException::withMessages([
                    'coach_id' => 'Select a coach assigned to this extra service.',
                ]);
            }

            $allowed = EmployeePlanCommissionRule::query()
                ->where('plan_id', $planId)
                ->where('employee_id', $coachId)
                ->where('is_active', true)
                ->exists();

            if (! $allowed) {
                throw ValidationException::withMessages([
                    'coach_id' => 'The selected coach is not assigned to this extra service.',
                ]);
            }

            return;
        }

        // No commission matrix: any active coach/captain is fine; coach optional.
        if ($coachId <= 0) {
            return;
        }

        $coach = Employee::query()->find($coachId);

        if ($coach === null || $coach->status !== 'active' || ! in_array($coach->role, ['coach', 'captain'], true)) {
            throw ValidationException::withMessages([
                'coach_id' => 'Select an active coach or captain for this extra service.',
            ]);
        }
    }
}
