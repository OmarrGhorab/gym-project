<?php

namespace App\Observers;

use App\Actions\Commissions\CalculateCommission;
use App\Actions\WhatsApp\SendMemberMessage;
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

            // phone and attendance_code are part of the payload (deep link + WhatsApp message), so they
            // must be selected here: loadMissing() inside the notifier will not add columns to an
            // already loaded relation.
            $fresh = $subscription->fresh(['member:id,name,phone,attendance_code', 'plan:id,name', 'soldBy:id,name', 'payments']) ?? $subscription;

            app(OperationalNotifier::class)->newSubscription($fresh);

            // Message the member their confirmation and entry barcode. No-ops
            // unless the gym has switched this event on in Settings -> WhatsApp.
            $sender = app(SendMemberMessage::class);
            $sender->handle($fresh, $sender->confirmationKeyFor($fresh));
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
