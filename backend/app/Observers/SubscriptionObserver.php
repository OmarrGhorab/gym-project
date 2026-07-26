<?php

namespace App\Observers;

use App\Actions\Commissions\CalculateCommission;
use App\Jobs\CalculateCommissionJob;
use App\Models\Subscription;
use App\Services\OperationalNotifier;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class SubscriptionObserver
{
    public function created(Subscription $subscription): void
    {
        DB::afterCommit(function () use ($subscription) {
            app(CalculateCommission::class)->forSource(
                $subscription->fresh(['plan']) ?? $subscription
            );
            CalculateCommissionJob::dispatch(Subscription::class, $subscription->id);
            app(OperationalNotifier::class)->newSubscription(
                // phone is part of the payload (deep link + WhatsApp action), so it must be selected here:
                // loadMissing() inside the notifier will not add columns to an already loaded relation.
                $subscription->fresh(['member:id,name,phone', 'plan:id,name', 'soldBy:id,name']) ?? $subscription,
            );
            Cache::forget('dashboard:summary:v1');
            Cache::forget('dashboard:summary:v2');
            Cache::forget('dashboard:summary:v3');
        });
    }

    public function updated(Subscription $subscription): void
    {
        DB::afterCommit(function () {
            Cache::forget('dashboard:summary:v1');
            Cache::forget('dashboard:summary:v2');
            Cache::forget('dashboard:summary:v3');
        });
    }

    public function deleted(Subscription $subscription): void
    {
        DB::afterCommit(function () {
            Cache::forget('dashboard:summary:v1');
            Cache::forget('dashboard:summary:v2');
            Cache::forget('dashboard:summary:v3');
        });
    }
}
