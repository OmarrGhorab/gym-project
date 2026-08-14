<?php

namespace App\Actions\Subscriptions;

use App\Models\Subscription;
use App\Models\SubscriptionFreeze;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class UnfreezeSubscription
{
    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(Subscription $subscription, array $data = []): Subscription
    {
        return DB::transaction(function () use ($subscription, $data): Subscription {
            $lockedSubscription = Subscription::query()
                ->lockForUpdate()
                ->with(['freezes'])
                ->findOrFail($subscription->id);

            if ($lockedSubscription->status !== 'frozen') {
                throw ValidationException::withMessages([
                    'subscription' => 'Only frozen subscriptions can be unfrozen.',
                ]);
            }

            $resumeOn = Carbon::parse($data['resume_on'] ?? Carbon::today())->startOfDay();
            $openFreeze = $lockedSubscription->freezes
                ->whereNull('resumed_on')
                ->filter(fn (SubscriptionFreeze $freeze): bool => $freeze->isEffectiveFreeze())
                ->sortByDesc('freeze_start')
                ->first();
            $endDate = $lockedSubscription->end_date;

            if ($openFreeze !== null) {
                if ($resumeOn->lt($openFreeze->freeze_start->startOfDay())) {
                    throw ValidationException::withMessages([
                        'resume_on' => 'Resume date must be on or after the freeze start date.',
                    ]);
                }

                $remainingDays = $openFreeze->remaining_days_at_freeze;

                if ($remainingDays === null) {
                    $remainingDays = max(0, (int) $openFreeze->freeze_start->startOfDay()->diffInDays($lockedSubscription->end_date, false));
                }

                $actualFrozenDays = max(0, (int) $openFreeze->freeze_start->startOfDay()->diffInDays($resumeOn, false));
                $endDate = $resumeOn->copy()->addDays($remainingDays);

                $openFreeze->update([
                    'resumed_on' => $resumeOn->toDateString(),
                    'days' => $actualFrozenDays,
                    'remaining_days_at_freeze' => $remainingDays,
                ]);
            }

            $lockedSubscription->update([
                'status' => 'active',
                'end_date' => $endDate->toDateString(),
            ]);

            return $lockedSubscription->fresh(['member', 'plan', 'soldBy', 'payments', 'freezes']);
        });
    }
}
