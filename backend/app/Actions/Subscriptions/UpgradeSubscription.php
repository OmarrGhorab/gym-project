<?php

namespace App\Actions\Subscriptions;

use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class UpgradeSubscription
{
    public function __construct(
        private readonly CreateSubscription $createSubscription,
    ) {}

    /**
     * Upgrade a member from one plan to another, applying prorated credit.
     *
     * @param  array<string, mixed>  $data
     */
    public function handle(Subscription $subscription, array $data, User $seller): Subscription
    {
        return DB::transaction(function () use ($subscription, $data, $seller): Subscription {
            $lockedSubscription = Subscription::query()
                ->lockForUpdate()
                ->with(['member', 'payments', 'plan'])
                ->findOrFail($subscription->id);

            if ($lockedSubscription->status !== 'active') {
                throw ValidationException::withMessages([
                    'subscription' => 'Only active subscriptions can be upgraded.',
                ]);
            }

            $newPlan = Plan::query()->findOrFail($data['plan_id']);

            if (! $newPlan->isSellable()) {
                throw ValidationException::withMessages([
                    'plan_id' => 'The selected plan is not currently sellable.',
                ]);
            }

            if ($lockedSubscription->plan_id === $newPlan->id) {
                throw ValidationException::withMessages([
                    'plan_id' => 'Use the renew endpoint to extend the same plan.',
                ]);
            }

            $credit = $this->calculateRemainingCredit($lockedSubscription);
            $extraDiscount = (float) ($data['discount'] ?? 0);
            $newPlanPrice = (float) $newPlan->price;
            $submittedPaymentAmount = bcadd((string) ($data['payment']['amount'] ?? '0.00'), '0.00', 2);
            $totalDiscount = min($newPlanPrice, $credit + $extraDiscount);
            $amountDue = bcsub((string) $newPlanPrice, (string) $totalDiscount, 2);

            if (bccomp($submittedPaymentAmount, $amountDue, 2) === 1) {
                $totalDiscount = min($newPlanPrice, $extraDiscount);
                $amountDue = bcsub((string) $newPlanPrice, (string) $totalDiscount, 2);
            }

            $paymentAmount = bccomp($submittedPaymentAmount, '0.00', 2) === 1
                ? $submittedPaymentAmount
                : max('0.00', $amountDue);

            $lockedSubscription->update(['status' => 'stopped']);

            $startDate = Carbon::today();
            $newSubscription = $this->createSubscription->handle([
                'member_id' => $lockedSubscription->member_id,
                'plan_id' => $newPlan->id,
                'start_date' => $startDate->toDateString(),
                'end_date' => $newPlan->endDateFrom($startDate)->toDateString(),
                'discount' => $totalDiscount,
                'payment' => [
                    'amount' => $paymentAmount,
                    'method' => $data['payment']['method'],
                    'paid_at' => $data['payment']['paid_at'] ?? null,
                ],
            ], $seller);

            $newSubscription->update([
                'upgraded_from_subscription_id' => $lockedSubscription->id,
            ]);

            return $newSubscription->fresh([
                'member', 'plan', 'soldBy', 'payments', 'upgradedFrom',
            ]);
        });
    }

    /**
     * Calculate prorated credit based on unused days of the current subscription.
     */
    private function calculateRemainingCredit(Subscription $subscription): float
    {
        $today = Carbon::today();

        if ($subscription->end_date === null || $subscription->end_date->lt($today)) {
            return 0.0;
        }

        $totalDays = max(1, (int) $subscription->start_date->diffInDays($subscription->end_date) + 1);
        $usedDays = max(0, (int) $subscription->start_date->diffInDays($today));
        $remainingDays = max(0, $totalDays - $usedDays);

        if ($remainingDays <= 0) {
            return 0.0;
        }

        $paidTotal = $subscription->payments
            ->filter(fn ($payment): bool => in_array($payment->status, ['paid', 'partial'], true))
            ->reduce(
                fn (string $carry, $payment): string => bcadd($carry, (string) $payment->amount, 2),
                '0.00',
            );

        if (bccomp($paidTotal, '0.00', 2) <= 0) {
            return 0.0;
        }

        $dailyRate = bcdiv($paidTotal, (string) $totalDays, 4);

        return (float) bcmul($dailyRate, (string) $remainingDays, 2);
    }
}
