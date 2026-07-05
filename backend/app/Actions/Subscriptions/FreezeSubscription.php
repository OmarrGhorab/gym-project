<?php

namespace App\Actions\Subscriptions;

use App\Models\Subscription;
use App\Models\SubscriptionFreeze;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class FreezeSubscription
{
    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(Subscription $subscription, array $data, User $user): Subscription
    {
        return DB::transaction(function () use ($subscription, $data, $user): Subscription {
            $lockedSubscription = Subscription::query()
                ->lockForUpdate()
                ->with(['plan', 'freezes'])
                ->findOrFail($subscription->id);

            if ($lockedSubscription->status !== 'active') {
                throw ValidationException::withMessages([
                    'subscription' => 'Only active subscriptions can be frozen.',
                ]);
            }

            $plan = $lockedSubscription->plan;
            $freezeStart = Carbon::parse($data['freeze_start'])->startOfDay();
            $freezeEnd = Carbon::parse($data['freeze_end'])->startOfDay();
            $days = $freezeStart->diffInDays($freezeEnd) + 1;
            $remainingDays = max(
                0,
                (int) $freezeStart->diffInDays($lockedSubscription->end_date, false),
            );

            $usedDays = (int) $lockedSubscription->freezes->sum('days');
            $maxFreezeDays = (int) $plan->max_freeze_days;
            $minFreezeDays = (int) $plan->min_freeze_days;

            if ($minFreezeDays > 0 && $days < $minFreezeDays) {
                throw ValidationException::withMessages([
                    'freeze_end' => "Selected {$days} freeze day(s), but this plan requires at least {$minFreezeDays}.",
                ]);
            }

            if ($maxFreezeDays < 1 || ($usedDays + $days) > $maxFreezeDays) {
                $remainingAllowance = max(0, $maxFreezeDays - $usedDays);

                throw ValidationException::withMessages([
                    'freeze_end' => "Selected {$days} freeze day(s), but this plan has {$remainingAllowance} freeze day(s) available.",
                ]);
            }

            if ($freezeStart->gt($lockedSubscription->end_date)) {
                throw ValidationException::withMessages([
                    'freeze_start' => 'Freeze start must be on or before the subscription end date.',
                ]);
            }

            if ($plan->freeze_requires_approval) {
                throw ValidationException::withMessages([
                    'subscription' => 'This plan requires admin approval before freezing.',
                ]);
            }

            SubscriptionFreeze::create([
                'subscription_id' => $lockedSubscription->id,
                'freeze_start' => $data['freeze_start'],
                'freeze_end' => $data['freeze_end'],
                'days' => $days,
                'remaining_days_at_freeze' => $remainingDays,
                'reason' => $data['reason'] ?? null,
                'created_by' => $user->id,
            ]);

            $lockedSubscription->update([
                'status' => 'frozen',
            ]);

            return $lockedSubscription->fresh(['member', 'plan', 'soldBy', 'payments', 'freezes']);
        });
    }
}
