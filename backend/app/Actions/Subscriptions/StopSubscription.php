<?php

namespace App\Actions\Subscriptions;

use App\Models\Subscription;
use Illuminate\Support\Carbon;
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

        // Close the period today so renew starts a new period from today (not stacked after old end_date).
        $subscription->update([
            'status' => 'stopped',
            'end_date' => Carbon::today()->toDateString(),
            'sessions_remaining' => 0,
        ]);

        return $subscription->fresh(['member', 'plan', 'soldBy', 'payments', 'freezes']);
    }
}
