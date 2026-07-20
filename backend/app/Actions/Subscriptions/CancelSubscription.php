<?php

namespace App\Actions\Subscriptions;

use App\Actions\ShiftSessions\ResolveOpenShiftSession;
use App\Models\Payment;
use App\Models\Subscription;
use App\Models\SubscriptionRefund;
use App\Models\User;
use App\Services\OperationalNotifier;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CancelSubscription
{
    public function __construct(
        private readonly OperationalNotifier $notifier,
        private readonly ResolveOpenShiftSession $openShiftSession,
    ) {}

    /**
     * Cancel within cancellation grace with an optional refund.
     *
     * @param  array<string, mixed>  $data
     */
    public function handle(Subscription $subscription, array $data, User $actor): Subscription
    {
        return DB::transaction(function () use ($subscription, $data, $actor): Subscription {
            $locked = Subscription::query()
                ->lockForUpdate()
                ->with(['payments', 'plan', 'member', 'refunds'])
                ->findOrFail($subscription->id);

            if (! in_array($locked->status, ['active', 'frozen'], true)) {
                throw ValidationException::withMessages([
                    'subscription' => 'Only active or frozen subscriptions can be cancelled with a refund.',
                ]);
            }

            if ($locked->refunds->isNotEmpty()) {
                throw ValidationException::withMessages([
                    'subscription' => 'This subscription has already been refunded.',
                ]);
            }

            $graceDays = $this->graceDays($locked);
            $graceEndsOn = $this->graceEndsOn($locked, $graceDays);

            if (Carbon::today()->gt($graceEndsOn)) {
                throw ValidationException::withMessages([
                    'subscription' => 'Cancellation with refund is only allowed within the grace period (until '.$graceEndsOn->toDateString().'). Use stop instead.',
                ]);
            }

            $paidTotal = $this->paidTotal($locked);
            $defaultRefund = $paidTotal;
            $refundAmount = array_key_exists('refund_amount', $data) && $data['refund_amount'] !== null && $data['refund_amount'] !== ''
                ? bcadd((string) $data['refund_amount'], '0.00', 2)
                : $defaultRefund;

            if (bccomp($refundAmount, '0.00', 2) === -1) {
                throw ValidationException::withMessages([
                    'refund_amount' => 'Refund amount cannot be negative.',
                ]);
            }

            if (bccomp($refundAmount, $paidTotal, 2) === 1) {
                throw ValidationException::withMessages([
                    'refund_amount' => 'Refund amount cannot exceed what was paid ('.$paidTotal.').',
                ]);
            }

            $method = (string) ($data['method'] ?? 'cash');
            $reason = isset($data['reason']) ? (string) $data['reason'] : null;

            if (bccomp($refundAmount, '0.00', 2) === 1) {
                SubscriptionRefund::query()->create([
                    'subscription_id' => $locked->id,
                    'amount' => $refundAmount,
                    'method' => $method,
                    'reason' => $reason,
                    'created_by' => $actor->id,
                    'refunded_at' => now(),
                ]);

                // Reverse cash/revenue so finance totals and shift cash drop by the refund.
                Payment::query()->create([
                    'payable_type' => Subscription::class,
                    'payable_id' => $locked->id,
                    'amount' => bcmul($refundAmount, '-1', 2),
                    'method' => $method,
                    'status' => Payment::STATUS_REFUNDED,
                    'paid_at' => now(),
                    'due_date' => null,
                    'created_by' => $actor->id,
                    'shift_session_id' => $this->openShiftSession->current()?->id,
                ]);
            }

            // End access immediately so days_left is 0 and renew starts a fresh period today.
            $locked->update([
                'status' => 'stopped',
                'end_date' => Carbon::today()->toDateString(),
                'sessions_remaining' => 0,
            ]);

            $fresh = $locked->fresh(['member', 'plan', 'soldBy', 'payments', 'freezes', 'refunds']);

            $this->notifier->subscriptionCancelled($fresh, $refundAmount, $actor);

            return $fresh;
        });
    }

    public function graceDays(Subscription $subscription): int
    {
        if ($subscription->cancellation_grace_days !== null) {
            return (int) $subscription->cancellation_grace_days;
        }

        return (int) ($subscription->plan?->cancellation_grace_days ?? 2);
    }

    public function graceEndsOn(Subscription $subscription, ?int $graceDays = null): Carbon
    {
        $days = $graceDays ?? $this->graceDays($subscription);
        $anchor = $subscription->start_date?->copy() ?? Carbon::parse($subscription->created_at)->startOfDay();

        // Grace is inclusive of start day: start + (graceDays - 1) when graceDays > 0,
        // e.g. grace 2 from June 10 allows cancel on June 10 and June 11.
        if ($days <= 0) {
            return $anchor->copy()->subDay();
        }

        return $anchor->copy()->addDays($days - 1);
    }

    public function defaultRefundAmount(Subscription $subscription): string
    {
        return $this->paidTotal($subscription);
    }

    private function paidTotal(Subscription $subscription): string
    {
        $fromPayments = $subscription->payments
            ->filter(fn ($payment): bool => in_array($payment->status, Payment::COLLECTED_STATUSES, true))
            ->reduce(
                fn (string $carry, $payment): string => bcadd($carry, (string) $payment->amount, 2),
                '0.00',
            );

        if (bccomp($fromPayments, '0.00', 2) === 1) {
            return $fromPayments;
        }

        return bcadd((string) ($subscription->price_paid ?? '0.00'), '0.00', 2);
    }
}
