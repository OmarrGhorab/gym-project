<?php

namespace App\Actions\Subscriptions;

use App\Models\Subscription;
use App\Models\SubscriptionFreeze;
use App\Models\User;
use App\Services\OperationalNotifier;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ApproveSubscriptionFreeze
{
    public function __construct(
        private readonly OperationalNotifier $notifier,
    ) {}

    public function handle(Subscription $subscription, SubscriptionFreeze $freeze, User $approver): Subscription
    {
        $approvedFreeze = null;

        $result = DB::transaction(function () use ($subscription, $freeze, $approver, &$approvedFreeze): Subscription {
            $lockedSubscription = Subscription::query()
                ->lockForUpdate()
                ->with(['plan', 'freezes'])
                ->findOrFail($subscription->id);
            $lockedFreeze = SubscriptionFreeze::query()
                ->lockForUpdate()
                ->whereBelongsTo($lockedSubscription)
                ->findOrFail($freeze->id);

            if (! $lockedFreeze->isPendingApproval()) {
                throw ValidationException::withMessages([
                    'freeze' => 'This freeze request has already been decided.',
                ]);
            }

            if ($lockedSubscription->status !== 'active') {
                throw ValidationException::withMessages([
                    'subscription' => 'Only an active subscription can accept a freeze request.',
                ]);
            }

            $freezeStart = $lockedFreeze->freeze_start->copy()->startOfDay();
            $today = Carbon::today();

            if ($freezeStart->lt($today)) {
                $freezeStart = $today;
            }

            if ($freezeStart->gt($lockedFreeze->freeze_end)) {
                throw ValidationException::withMessages([
                    'freeze' => 'This freeze request has expired. Dismiss it and create a new request.',
                ]);
            }

            $days = $freezeStart->diffInDays($lockedFreeze->freeze_end) + 1;
            $usedDays = (int) $lockedSubscription->freezes
                ->where('id', '!=', $lockedFreeze->id)
                ->reject(fn (SubscriptionFreeze $item): bool => $item->approval_status === SubscriptionFreeze::APPROVAL_DISMISSED)
                ->sum('days');

            if ($lockedSubscription->plan->max_freeze_days < 1
                || ($usedDays + $days) > $lockedSubscription->plan->max_freeze_days) {
                throw ValidationException::withMessages([
                    'freeze' => 'This request no longer fits the plan freeze allowance.',
                ]);
            }

            $remainingDays = max(
                0,
                (int) $freezeStart->diffInDays($lockedSubscription->end_date, false),
            );

            $lockedFreeze->update([
                'freeze_start' => $freezeStart->toDateString(),
                'days' => $days,
                'remaining_days_at_freeze' => $remainingDays,
                'approved_by' => $approver->id,
                'approved_at' => now(),
                'approval_status' => SubscriptionFreeze::APPROVAL_APPROVED,
            ]);

            $lockedSubscription->update(['status' => 'frozen']);
            $approvedFreeze = $lockedFreeze->fresh(['subscription.member', 'subscription.plan', 'createdBy']);

            return $lockedSubscription->fresh(['member', 'plan', 'soldBy', 'payments', 'freezes']);
        });

        if ($approvedFreeze instanceof SubscriptionFreeze) {
            $this->notifier->freezeApprovalDecided($approvedFreeze, approved: true);
        }

        return $result;
    }
}
