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
                ->with('plan')
                ->findOrFail($subscription->id);

            $paidSoFar = bcadd((string) $lockedSubscription->payments()->sum('amount'), '0.00', 2);

            $amount = bcadd((string) $data['amount'], '0.00', 2);
            $newTotal = bcadd($paidSoFar, $amount, 2);
            $owed = (string) $lockedSubscription->price_paid;

            if (bccomp($newTotal, $owed, 2) === 1) {
                $this->extendSubscriptionForOverpayment($lockedSubscription, bcsub($newTotal, $owed, 2));
            }

            $remaining = bccomp($newTotal, $owed, 2) === 1 ? '0.00' : bcsub($owed, $newTotal, 2);
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

    private function extendSubscriptionForOverpayment(Subscription $subscription, string $extraAmount): void
    {
        if (bccomp($extraAmount, '0.00', 2) <= 0) {
            return;
        }

        if ($subscription->end_date === null || $subscription->plan === null) {
            throw ValidationException::withMessages([
                'amount' => 'Extra payment cannot extend a subscription without an end date and plan.',
            ]);
        }

        $durationDays = max(1, (int) $subscription->start_date->diffInDays($subscription->end_date));
        $dailyRate = bcdiv((string) $subscription->price_paid, (string) $durationDays, 4);

        if (bccomp($dailyRate, '0.0000', 4) <= 0) {
            throw ValidationException::withMessages([
                'amount' => 'Extra payment cannot extend a zero-value subscription.',
            ]);
        }

        $extraDays = (int) floor((float) bcdiv($extraAmount, $dailyRate, 4));

        if ($extraDays < 1) {
            return;
        }

        $subscription->forceFill([
            'end_date' => $subscription->end_date->copy()->addDays($extraDays)->toDateString(),
        ])->save();
    }
}
