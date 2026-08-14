<?php

namespace App\Actions\Subscriptions;

use App\Models\Subscription;
use App\Models\SubscriptionFreeze;
use App\Models\User;
use App\Services\OperationalNotifier;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class DismissSubscriptionFreeze
{
    public function __construct(
        private readonly OperationalNotifier $notifier,
    ) {}

    public function handle(Subscription $subscription, SubscriptionFreeze $freeze, User $approver): Subscription
    {
        $dismissedFreeze = null;

        $result = DB::transaction(function () use ($subscription, $freeze, $approver, &$dismissedFreeze): Subscription {
            $lockedSubscription = Subscription::query()
                ->lockForUpdate()
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

            $lockedFreeze->update([
                'approval_status' => SubscriptionFreeze::APPROVAL_DISMISSED,
                'dismissed_by' => $approver->id,
                'dismissed_at' => now(),
            ]);
            $dismissedFreeze = $lockedFreeze->fresh(['subscription.member', 'subscription.plan', 'createdBy']);

            return $lockedSubscription->fresh(['member', 'plan', 'soldBy', 'payments', 'freezes']);
        });

        if ($dismissedFreeze instanceof SubscriptionFreeze) {
            $this->notifier->freezeApprovalDecided($dismissedFreeze, approved: false);
        }

        return $result;
    }
}
