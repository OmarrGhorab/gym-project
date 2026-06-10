<?php

namespace App\Actions\Subscriptions;

use App\Models\Subscription;
use Illuminate\Validation\ValidationException;

class StopSubscription
{
    public function handle(Subscription $subscription): Subscription
    {
        if (in_array($subscription->status, ['stopped', 'expired'], true)) {
            throw ValidationException::withMessages([
                'subscription' => 'This subscription cannot be stopped from its current state.',
            ]);
        }

        $subscription->update(['status' => 'stopped']);

        return $subscription->fresh(['member', 'plan', 'soldBy', 'payments', 'freezes']);
    }
}
