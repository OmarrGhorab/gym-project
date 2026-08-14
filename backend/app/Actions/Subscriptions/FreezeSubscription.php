<?php

namespace App\Actions\Subscriptions;

use App\Models\Subscription;
use App\Models\SubscriptionFreeze;
use App\Models\User;
use App\Services\OperationalNotifier;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class FreezeSubscription
{
    public function __construct(
        private readonly OperationalNotifier $notifier,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(Subscription $subscription, array $data, User $user): Subscription
    {
        $pendingFreeze = null;

        $result = DB::transaction(function () use ($subscription, $data, $user, &$pendingFreeze): Subscription {
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

            if ($lockedSubscription->freezes->contains->isPendingApproval()) {
                throw ValidationException::withMessages([
                    'subscription' => 'A freeze request is already waiting for approval.',
                ]);
            }

            $usedDays = (int) $lockedSubscription->freezes
                ->reject(fn (SubscriptionFreeze $freeze): bool => $freeze->approval_status === SubscriptionFreeze::APPROVAL_DISMISSED)
                ->sum('days');
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

            $needsApproval = (bool) $plan->freeze_requires_approval;
            // Requiring approval must always create a decision point. An admin
            // who submits the request can still approve it afterward, but the
            // request must not silently approve itself.
            $approvalStatus = $needsApproval
                ? SubscriptionFreeze::APPROVAL_PENDING
                : SubscriptionFreeze::APPROVAL_NOT_REQUIRED;

            $freeze = SubscriptionFreeze::create([
                'subscription_id' => $lockedSubscription->id,
                'freeze_start' => $data['freeze_start'],
                'freeze_end' => $data['freeze_end'],
                'days' => $days,
                // A pending request is still active access. Snapshot the unused
                // days only when an approver actually pauses the membership.
                'remaining_days_at_freeze' => $approvalStatus === SubscriptionFreeze::APPROVAL_PENDING
                    ? null
                    : $remainingDays,
                'reason' => $data['reason'] ?? null,
                'created_by' => $user->id,
                'approved_by' => null,
                'approved_at' => null,
                'approval_status' => $approvalStatus,
            ]);

            if ($approvalStatus === SubscriptionFreeze::APPROVAL_PENDING) {
                $pendingFreeze = $freeze;
            } else {
                $lockedSubscription->update([
                    'status' => 'frozen',
                ]);
            }

            return $lockedSubscription->fresh(['member', 'plan', 'soldBy', 'payments', 'freezes']);
        });

        if ($pendingFreeze instanceof SubscriptionFreeze) {
            $this->notifier->freezeApprovalRequested($pendingFreeze);
        }

        return $result;
    }
}
