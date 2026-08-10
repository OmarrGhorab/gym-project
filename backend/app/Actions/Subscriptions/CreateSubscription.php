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
        $plan = Plan::query()->with('packageItems.includedPlan')->findOrFail($data['plan_id']);

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

        return DB::transaction(function () use ($data, $seller, $member, $plan): Subscription {
            $startDate = Carbon::parse($data['start_date'])->startOfDay();
            // A custom end date only moves the expiry for this one member — staff
            // use it to extend or shorten a period as a courtesy. The plan is
            // still sold as a single plan, so price and sessions never multiply.
            $endDate = isset($data['end_date'])
                ? Carbon::parse($data['end_date'])->startOfDay()
                : $plan->endDateFrom($startDate);
            $discount = number_format((float) ($data['discount'] ?? 0), 2, '.', '');
            $subtotal = bcadd((string) $plan->price, '0.00', 2);
            $pricePaid = bcsub($subtotal, $discount, 2);
            $sessionAllowance = $plan->is_unlimited_sessions || $plan->sessions_count === null
                ? null
                : (int) $plan->sessions_count;

            if (bccomp($pricePaid, '0.00', 2) === -1) {
                throw ValidationException::withMessages([
                    'discount' => 'Discount cannot exceed the subscription total.',
                ]);
            }

            $subscription = Subscription::create([
                'member_id' => $member->id,
                'plan_id' => $plan->id,
                'coach_id' => $data['coach_id'] ?? null,
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

            if (in_array($plan->type, ['offer_package', 'membership_extra_service'], true)) {
                $this->createIncludedPackageAddons($subscription, $plan, $startDate, $seller, $data['included_addons'] ?? []);
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

            // An extra service is paid for independently. When staff sell a new
            // main gym plan, keep any still-valid active extras with the member's
            // new current subscription instead of charging for or hiding them.
            $this->carryForwardActiveAddons($subscription, $startDate);

            return $subscription->fresh(['member', 'plan', 'soldBy', 'payments', 'addons.plan', 'addons.coach', 'addons.payments']) ?? $subscription;
        });
    }

    private function coachCanSellAddon(int $planId, int $coachId): bool
    {
        return EmployeePlanCommissionRule::query()
            ->where('plan_id', $planId)
            ->where('employee_id', $coachId)
            ->where('is_active', true)
            ->exists();
    }

    private function carryForwardActiveAddons(Subscription $subscription, Carbon $startDate): void
    {
        SubscriptionAddon::query()
            ->where('member_id', $subscription->member_id)
            ->where('status', 'active')
            ->where(function ($query) use ($subscription): void {
                $query->where('subscription_id', '!=', $subscription->id)
                    ->orWhereNull('subscription_id');
            })
            ->where(function ($query) use ($startDate): void {
                $query->whereNull('end_date')
                    ->orWhereDate('end_date', '>=', $startDate->toDateString());
            })
            ->lockForUpdate()
            ->update(['subscription_id' => $subscription->id]);
    }

    private function createIncludedPackageAddons(Subscription $subscription, Plan $package, Carbon $startDate, User $seller, array $overrides = []): void
    {
        foreach ($package->packageItems as $item) {
            $addonPlan = $item->includedPlan;

            $override = collect($overrides)->firstWhere('plan_id', $item->included_plan_id);
            $coachId = (int) ($override['coach_id'] ?? $item->coach_id);

            if ($addonPlan === null || ! $addonPlan->isSellable() || $addonPlan->category === 'gym_access') {
                throw ValidationException::withMessages([
                    'plan_id' => 'This offer package has an invalid or unavailable included add-on.',
                ]);
            }

            if (! $this->coachCanSellAddon($addonPlan->id, $coachId)) {
                throw ValidationException::withMessages([
                    'plan_id' => 'A coach must be assigned to every included add-on in this offer package.',
                ]);
            }

            $sessionAllowance = $addonPlan->is_unlimited_sessions || $addonPlan->sessions_count === null
                ? null
                : (int) $addonPlan->sessions_count;

            SubscriptionAddon::create([
                'subscription_id' => $subscription->id,
                'member_id' => $subscription->member_id,
                'plan_id' => $addonPlan->id,
                'coach_id' => $coachId,
                'start_date' => $startDate->toDateString(),
                'end_date' => $addonPlan->endDateFrom($startDate)->toDateString(),
                'status' => 'active',
                'price_paid' => '0.00',
                'discount' => (string) $addonPlan->price,
                'sessions_total' => $sessionAllowance,
                'sessions_remaining' => $sessionAllowance,
                'sold_by_user_id' => $seller->id,
                'created_by' => $seller->id,
            ]);
        }
    }
}
