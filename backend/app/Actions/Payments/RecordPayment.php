<?php

namespace App\Actions\Payments;

use App\Actions\ShiftSessions\ResolveOpenShiftSession;
use App\Models\Payment;
use App\Models\Subscription;
use App\Models\SubscriptionAddon;
use App\Models\User;
use App\Services\OperationalNotifier;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class RecordPayment
{
    public function __construct(
        private readonly ResolveOpenShiftSession $openShiftSession,
        private readonly OperationalNotifier $notifier,
    ) {}

    /**
     * Money above the balance is kept as money. Paying 1200 against a 1000
     * membership means the gym took 1200 — it does not, on its own, mean the
     * member bought more time. Turning the excess into days is a separate
     * decision the desk has to ask for with `extend_days_for_overpayment`.
     *
     * @param  array<string, mixed>  $data
     */
    public function handle(Subscription|SubscriptionAddon $payable, array $data, ?User $creator = null): Payment
    {
        return DB::transaction(function () use ($payable, $data, $creator): Payment {
            $lockedPayable = $payable instanceof Subscription
                ? Subscription::query()
                    ->lockForUpdate()
                    ->with('plan')
                    ->findOrFail($payable->id)
                : SubscriptionAddon::query()
                    ->lockForUpdate()
                    ->with('plan')
                    ->findOrFail($payable->id);

            $paidSoFar = bcadd((string) $lockedPayable->payments()->sum('amount'), '0.00', 2);

            $amount = bcadd((string) $data['amount'], '0.00', 2);
            $newTotal = bcadd($paidSoFar, $amount, 2);
            $owed = (string) $lockedPayable->price_paid;

            $extraDays = 0;

            if (bccomp($newTotal, $owed, 2) === 1 && $this->wantsExtraDays($data)) {
                $extraAmount = bcsub($newTotal, $owed, 2);
                $extraDays = $this->extendSubscriptionForOverpayment($lockedPayable, $extraAmount);

                if ($extraDays > 0) {
                    $this->notifier->membershipDaysBoughtByOverpayment(
                        $lockedPayable->fresh() ?? $lockedPayable,
                        $extraDays,
                        $extraAmount,
                        $creator,
                    );
                }
            }

            $remaining = bccomp($newTotal, $owed, 2) === 1 ? '0.00' : bcsub($owed, $newTotal, 2);
            $status = bccomp($remaining, '0.00', 2) === 0 ? 'paid' : 'partial';

            $openSessionId = $this->openShiftSession->current()?->id;

            return Payment::create([
                'payable_type' => $lockedPayable::class,
                'payable_id' => $lockedPayable->id,
                'amount' => $amount,
                'method' => $data['method'],
                'status' => $status,
                'paid_at' => $data['paid_at'] ?? now(),
                'due_date' => bccomp($remaining, '0.00', 2) === 1 ? now()->toDateString() : null,
                'created_by' => $creator?->id,
                // Prefer live open desk session so membership revenue lands on Shift desk.
                'shift_session_id' => $openSessionId ?? ($data['shift_session_id'] ?? null),
            ]);
        });
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function wantsExtraDays(array $data): bool
    {
        return filter_var($data['extend_days_for_overpayment'] ?? false, FILTER_VALIDATE_BOOL);
    }

    /** @return int the number of days the excess bought */
    private function extendSubscriptionForOverpayment(Subscription|SubscriptionAddon $subscription, string $extraAmount): int
    {
        if (bccomp($extraAmount, '0.00', 2) <= 0) {
            return 0;
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
            return 0;
        }

        $subscription->forceFill([
            'end_date' => $subscription->end_date->copy()->addDays($extraDays)->toDateString(),
        ])->save();

        return $extraDays;
    }
}
