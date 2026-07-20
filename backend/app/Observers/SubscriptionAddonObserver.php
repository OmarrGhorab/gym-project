<?php

namespace App\Observers;

use App\Actions\Commissions\CalculateCommission;
use App\Models\SubscriptionAddon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class SubscriptionAddonObserver
{
    public function created(SubscriptionAddon $subscriptionAddon): void
    {
        DB::afterCommit(function () use ($subscriptionAddon): void {
            app(CalculateCommission::class)->forSource(
                $subscriptionAddon->fresh(['plan', 'coach.planCommissionRules']) ?? $subscriptionAddon,
            );
            Cache::forget('dashboard:summary:v1');
            Cache::forget('dashboard:summary:v2');
            Cache::forget('dashboard:summary:v3');
        });
    }

    public function updated(SubscriptionAddon $subscriptionAddon): void
    {
        DB::afterCommit(function (): void {
            Cache::forget('dashboard:summary:v1');
            Cache::forget('dashboard:summary:v2');
            Cache::forget('dashboard:summary:v3');
        });
    }
}
