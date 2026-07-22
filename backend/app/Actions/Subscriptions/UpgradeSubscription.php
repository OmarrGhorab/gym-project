<?php

namespace App\Actions\Subscriptions;

use App\Actions\ShiftSessions\ResolveOpenShiftSession;
use App\Models\Payment;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\SubscriptionRefund;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class UpgradeSubscription
{
    public const CREDIT_MODE_FULL_DIFFERENCE = 'full_difference';

    public const CREDIT_MODE_DAY_PRORATION = 'day_proration';

    public function __construct(
        private readonly CreateSubscription $createSubscription,
        private readonly ResolveOpenShiftSession $openShiftSession,
    ) {}

    /**
     * Upgrade a member from one plan to another.
     *
     * Default credit mode is full plan price difference (new − old paid credit).
     * Day-proration remains available via credit_mode=day_proration.
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

            if ($newPlan->category !== 'gym_access') {
                throw ValidationException::withMessages([
                    'plan_id' => 'Main membership can only be changed to a gym access plan. Use Add extra for services (PT, classes, nutrition, recovery).',
                ]);
            }

            if ($lockedSubscription->plan_id === $newPlan->id) {
                throw ValidationException::withMessages([
                    'plan_id' => 'Use the renew endpoint to extend the same plan.',
                ]);
            }

            $creditMode = (string) ($data['credit_mode'] ?? self::CREDIT_MODE_FULL_DIFFERENCE);
            if (! in_array($creditMode, [self::CREDIT_MODE_FULL_DIFFERENCE, self::CREDIT_MODE_DAY_PRORATION], true)) {
                throw ValidationException::withMessages([
                    'credit_mode' => 'Credit mode must be full_difference or day_proration.',
                ]);
            }

            $extraDiscount = (float) ($data['discount'] ?? 0);
            $newPlanPrice = (float) $newPlan->price;
            $submittedPaymentAmount = bcadd((string) ($data['payment']['amount'] ?? '0.00'), '0.00', 2);

            $baseCredit = $creditMode === self::CREDIT_MODE_DAY_PRORATION
                ? $this->calculateRemainingCredit($lockedSubscription)
                : $this->calculateFullDifferenceCredit($lockedSubscription);

            $totalDiscount = min($newPlanPrice, $baseCredit + $extraDiscount);
            $amountDue = bcsub((string) $newPlanPrice, (string) $totalDiscount, 2);

            // Paying more than the computed due amount means the staff is intentionally
            // skipping/reducing credit — only apply the explicit extra discount.
            if (bccomp($submittedPaymentAmount, $amountDue, 2) === 1) {
                $totalDiscount = min($newPlanPrice, $extraDiscount);
                $amountDue = bcsub((string) $newPlanPrice, (string) $totalDiscount, 2);
            }

            // Explicit amount_due override from staff/admin (bounded 0..new plan price).
            if (array_key_exists('amount_due', $data) && $data['amount_due'] !== null && $data['amount_due'] !== '') {
                $overrideDue = bcadd((string) $data['amount_due'], '0.00', 2);
                if (bccomp($overrideDue, '0.00', 2) === -1 || bccomp($overrideDue, (string) $newPlanPrice, 2) === 1) {
                    throw ValidationException::withMessages([
                        'amount_due' => 'Amount due must be between 0 and the new plan price.',
                    ]);
                }
                $amountDue = $overrideDue;
                $totalDiscount = (float) bcsub((string) $newPlanPrice, $amountDue, 2);
            }

            $paymentAmount = bccomp($submittedPaymentAmount, '0.00', 2) === 1
                ? $submittedPaymentAmount
                : max('0.00', $amountDue);

            $lockedSubscription->update(['status' => 'stopped']);

            $excessCredit = bcsub((string) $baseCredit, (string) $newPlanPrice, 2);
            if (bccomp($excessCredit, '0.00', 2) === 1) {
                SubscriptionRefund::query()->create([
                    'subscription_id' => $lockedSubscription->id,
                    'amount' => $excessCredit,
                    'method' => (string) ($data['payment']['method'] ?? 'cash'),
                    'reason' => 'Plan downgrade refund difference',
                    'created_by' => $seller->id,
                    'refunded_at' => now(),
                ]);

                Payment::query()->create([
                    'payable_type' => Subscription::class,
                    'payable_id' => $lockedSubscription->id,
                    'amount' => bcmul($excessCredit, '-1', 2),
                    'method' => (string) ($data['payment']['method'] ?? 'cash'),
                    'status' => Payment::STATUS_REFUNDED,
                    'paid_at' => now(),
                    'due_date' => null,
                    'created_by' => $seller->id,
                    'shift_session_id' => $this->openShiftSession->current()?->id,
                ]);
            }

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
     * Full difference credit: treat paid amount on the old plan as credit toward the new plan.
     * amount due defaults to max(0, new_price − paid_on_old).
     */
    private function calculateFullDifferenceCredit(Subscription $subscription): float
    {
        // Credit only what was actually paid on the old subscription (not unpaid balance).
        return (float) max('0.00', $this->paidTotal($subscription));
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

        $paidTotal = $this->paidTotal($subscription);

        if (bccomp($paidTotal, '0.00', 2) <= 0) {
            return 0.0;
        }

        $dailyRate = bcdiv($paidTotal, (string) $totalDays, 4);

        return (float) bcmul($dailyRate, (string) $remainingDays, 2);
    }

    private function paidTotal(Subscription $subscription): string
    {
        return $subscription->payments
            ->filter(fn ($payment): bool => in_array($payment->status, ['paid', 'partial'], true))
            ->reduce(
                fn (string $carry, $payment): string => bcadd($carry, (string) $payment->amount, 2),
                '0.00',
            );
    }
}
