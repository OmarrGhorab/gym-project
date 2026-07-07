<?php

namespace App\Observers;

use App\Jobs\CalculateCommissionJob;
use App\Models\SubscriptionAddon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class SubscriptionAddonObserver
{
    public function created(SubscriptionAddon $subscriptionAddon): void
    {
        DB::afterCommit(function () use ($subscriptionAddon): void {
            CalculateCommissionJob::dispatch(SubscriptionAddon::class, $subscriptionAddon->id);
            Cache::forget('dashboard:summary:v1');
            Cache::forget('dashboard:summary:v2');
        });
    }

    public function updated(SubscriptionAddon $subscriptionAddon): void
    {
        DB::afterCommit(function (): void {
            Cache::forget('dashboard:summary:v1');
            Cache::forget('dashboard:summary:v2');
        });
    }
}
