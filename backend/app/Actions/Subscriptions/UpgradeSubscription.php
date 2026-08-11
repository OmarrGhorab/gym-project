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
                ->with(['member', 'payments', 'plan', 'refunds'])
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

            $netPrice = max(0.0, $newPlanPrice - $extraDiscount);
            $appliedCredit = min($baseCredit, $netPrice);
            $remainingDue = max(0.0, $netPrice - $appliedCredit);
            $excessCredit = max(0.0, $baseCredit - $netPrice);

            // Explicit amount_due override from staff/admin (bounded 0..new plan price).
            if (array_key_exists('amount_due', $data) && $data['amount_due'] !== null && $data['amount_due'] !== '') {
                $overrideDue = bcadd((string) $data['amount_due'], '0.00', 2);
                if (bccomp($overrideDue, '0.00', 2) === -1 || bccomp($overrideDue, (string) $newPlanPrice, 2) === 1) {
                    throw ValidationException::withMessages([
                        'amount_due' => 'Amount due must be between 0 and the new plan price.',
                    ]);
                }
                $remainingDue = (float) $overrideDue;
            }

            $cashPaymentAmount = bccomp($submittedPaymentAmount, '0.00', 2) === 1
                ? (float) $submittedPaymentAmount
                : $remainingDue;

            $lockedSubscription->update(['status' => 'stopped']);

            if ($excessCredit > 0) {
                $excessCreditStr = number_format($excessCredit, 2, '.', '');
                SubscriptionRefund::query()->create([
                    'subscription_id' => $lockedSubscription->id,
                    'amount' => $excessCreditStr,
                    'method' => (string) ($data['payment']['method'] ?? 'cash'),
                    'reason' => 'Plan downgrade refund difference',
                    'created_by' => $seller->id,
                    'refunded_at' => now(),
                ]);

                Payment::query()->create([
                    'payable_type' => Subscription::class,
                    'payable_id' => $lockedSubscription->id,
                    'amount' => bcmul($excessCreditStr, '-1', 2),
                    'method' => (string) ($data['payment']['method'] ?? 'cash'),
                    'status' => Payment::STATUS_REFUNDED,
                    'paid_at' => now(),
                    'due_date' => null,
                    'created_by' => $seller->id,
                    'shift_session_id' => $this->openShiftSession->current()?->id,
                ]);
            }

            // A plan change sold in advance starts on the date staff picked, not
            // the day it was rung up. The old period still stops now, so the
            // member has no access between the two — that is what "starts on the
            // 19th" means, and check-in already enforces it.
            $startDate = isset($data['start_date']) && $data['start_date'] !== ''
                ? Carbon::parse($data['start_date'])->startOfDay()
                : Carbon::today();
            $endDate = isset($data['end_date']) && $data['end_date'] !== ''
                ? Carbon::parse($data['end_date'])->startOfDay()
                : $newPlan->endDateFrom($startDate);
            $newSubscription = $this->createSubscription->handle([
                'member_id' => $lockedSubscription->member_id,
                'plan_id' => $newPlan->id,
                // Fall back to the coach already on the membership so a plan change
                // that does not ask for one does not silently unassign the member.
                'coach_id' => $data['coach_id'] ?? $lockedSubscription->coach_id,
                'start_date' => $startDate->toDateString(),
                'end_date' => $endDate->toDateString(),
                'discount' => $extraDiscount,
                'payment' => [
                    'amount' => number_format($cashPaymentAmount, 2, '.', ''),
                    'method' => $data['payment']['method'],
                    'paid_at' => $data['payment']['paid_at'] ?? null,
                ],
                'addons' => $data['addons'] ?? [],
                'included_addons' => $data['included_addons'] ?? [],
            ], $seller);

            if ($appliedCredit > 0) {
                // This settles the new subscription balance, but is not a new
                // collection. It must stay out of revenue and shift totals.
                Payment::query()->create([
                    'payable_type' => Subscription::class,
                    'payable_id' => $newSubscription->id,
                    'amount' => number_format($appliedCredit, 2, '.', ''),
                    'method' => 'credit',
                    'status' => Payment::STATUS_CREDIT,
                    'paid_at' => now(),
                    'due_date' => null,
                    'created_by' => $seller->id,
                    'shift_session_id' => null,
                ]);
            }

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
        $paymentTotal = $subscription->payments
            ->filter(fn ($payment): bool => in_array($payment->status, Payment::SETTLEMENT_STATUSES, true))
            ->reduce(
                fn (string $carry, $payment): string => bcadd($carry, (string) $payment->amount, 2),
                '0.00',
            );

        $refundTotal = $subscription->refunds
            ->reduce(
                fn (string $carry, $refund): string => bcadd($carry, (string) $refund->amount, 2),
                '0.00',
            );

        $netPaid = bcsub($paymentTotal, $refundTotal, 2);

        return bccomp($netPaid, '0.00', 2) === 1 ? $netPaid : '0.00';
    }
}
