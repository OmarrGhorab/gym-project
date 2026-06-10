<?php

namespace App\Actions\Payments;

use App\Models\Payment;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class RecordPayment
{
    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(Subscription $subscription, array $data, ?User $creator = null): Payment
    {
        return DB::transaction(function () use ($subscription, $data, $creator): Payment {
            $lockedSubscription = Subscription::query()
                ->lockForUpdate()
                ->with('payments')
                ->findOrFail($subscription->id);

            $paidSoFar = $lockedSubscription->payments
                ->reduce(fn (string $carry, Payment $payment) => bcadd($carry, (string) $payment->amount, 2), '0.00');

            $amount = number_format((float) $data['amount'], 2, '.', '');
            $newTotal = bcadd($paidSoFar, $amount, 2);
            $owed = (string) $lockedSubscription->price_paid;

            if (bccomp($paidSoFar, $owed, 2) >= 0) {
                throw ValidationException::withMessages([
                    'subscription_id' => 'This subscription is already settled.',
                ]);
            }

            if (bccomp($newTotal, $owed, 2) === 1) {
                throw ValidationException::withMessages([
                    'payment.amount' => 'Payment amount exceeds the outstanding balance.',
                ]);
            }

            $remaining = bcsub($owed, $newTotal, 2);
            $status = bccomp($remaining, '0.00', 2) === 0 ? 'paid' : 'partial';

            return Payment::create([
                'payable_type' => Subscription::class,
                'payable_id' => $lockedSubscription->id,
                'amount' => $amount,
                'method' => $data['method'],
                'status' => $status,
                'paid_at' => $data['paid_at'] ?? now(),
                'due_date' => bccomp($remaining, '0.00', 2) === 1 ? now()->toDateString() : null,
                'created_by' => $creator?->id,
            ]);
        });
    }
}
