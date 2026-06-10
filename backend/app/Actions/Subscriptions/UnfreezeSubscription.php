<?php

namespace App\Actions\Subscriptions;

use App\Models\Subscription;
use Illuminate\Validation\ValidationException;

class UnfreezeSubscription
{
    public function handle(Subscription $subscription): Subscription
    {
        if ($subscription->status !== 'frozen') {
            throw ValidationException::withMessages([
                'subscription' => 'Only frozen subscriptions can be unfrozen.',
            ]);
        }

        $subscription->update(['status' => 'active']);

        return $subscription->fresh(['member', 'plan', 'soldBy', 'payments', 'freezes']);
    }
}
