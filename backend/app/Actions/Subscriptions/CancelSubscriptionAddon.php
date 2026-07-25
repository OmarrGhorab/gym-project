<?php

namespace App\Actions\Subscriptions;

use App\Actions\ShiftSessions\ResolveOpenShiftSession;
use App\Models\Payment;
use App\Models\Subscription;
use App\Models\SubscriptionAddon;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class CancelSubscriptionAddon
{
    public function __construct(private readonly ResolveOpenShiftSession $openShiftSession) {}

    /** @param array<string, mixed> $data */
    public function handle(Subscription $subscription, SubscriptionAddon $addon, array $data, User $actor): Subscription
    {
        return DB::transaction(function () use ($subscription, $addon, $data, $actor): Subscription {
            $lockedSubscription = Subscription::query()->lockForUpdate()->findOrFail($subscription->id);
            $lockedAddon = SubscriptionAddon::query()->lockForUpdate()->with('payments')->findOrFail($addon->id);

            if ($lockedAddon->subscription_id !== $lockedSubscription->id) {
                throw ValidationException::withMessages(['addon' => 'This extra service does not belong to the subscription.']);
            }

            if (! in_array($lockedSubscription->status, ['active', 'frozen'], true) || $lockedAddon->status !== 'active') {
                throw ValidationException::withMessages(['addon' => 'Only an active extra service can be refunded.']);
            }

            $paidTotal = $lockedAddon->payments
                ->filter(fn (Payment $payment): bool => in_array($payment->status, Payment::COLLECTED_STATUSES, true))
                ->reduce(fn (string $carry, Payment $payment): string => bcadd($carry, (string) $payment->amount, 2), '0.00');
            $refundAmount = bcadd((string) ($data['refund_amount'] ?? $paidTotal), '0.00', 2);

            if (bccomp($refundAmount, '0.00', 2) === -1 || bccomp($refundAmount, $paidTotal, 2) === 1) {
                throw ValidationException::withMessages(['refund_amount' => 'Refund amount cannot exceed what was paid for this extra service.']);
            }

            if (bccomp($refundAmount, '0.00', 2) === 1) {
                Payment::query()->create([
                    'payable_type' => SubscriptionAddon::class,
                    'payable_id' => $lockedAddon->id,
                    'amount' => bcmul($refundAmount, '-1', 2),
                    'method' => (string) ($data['method'] ?? 'cash'),
                    'status' => Payment::STATUS_REFUNDED,
                    'paid_at' => now(),
                    'created_by' => $actor->id,
                    'shift_session_id' => $this->openShiftSession->current()?->id,
                ]);
            }

            $lockedAddon->update([
                'status' => 'stopped',
                'end_date' => Carbon::today()->toDateString(),
                'sessions_remaining' => 0,
            ]);

            return $lockedSubscription->fresh(['member', 'plan', 'soldBy', 'payments', 'freezes', 'refunds', 'addons.plan', 'addons.coach', 'addons.payments']);
        });
    }
}
