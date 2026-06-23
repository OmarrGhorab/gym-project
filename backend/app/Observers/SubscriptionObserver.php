<?php

namespace App\Observers;

use App\Jobs\CalculateCommissionJob;
use App\Models\Subscription;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class SubscriptionObserver
{
    public function created(Subscription $subscription): void
    {
        DB::afterCommit(function () use ($subscription) {
            CalculateCommissionJob::dispatch(Subscription::class, $subscription->id);
            Cache::forget('dashboard:summary:v1');
        });
    }

    public function updated(Subscription $subscription): void
    {
        DB::afterCommit(function () {
            Cache::forget('dashboard:summary:v1');
        });
    }

    public function deleted(Subscription $subscription): void
    {
        DB::afterCommit(function () {
            Cache::forget('dashboard:summary:v1');
        });
    }
}
