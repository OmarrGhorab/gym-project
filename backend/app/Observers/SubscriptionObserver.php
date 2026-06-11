<?php

namespace App\Observers;

use App\Actions\Commissions\CalculateCommission;
use App\Models\Subscription;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class SubscriptionObserver
{
    public function created(Subscription $subscription): void
    {
        DB::afterCommit(function () use ($subscription) {
            app(CalculateCommission::class)->forSource($subscription);
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
