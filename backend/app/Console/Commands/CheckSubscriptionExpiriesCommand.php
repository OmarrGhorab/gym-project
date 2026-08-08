<?php

namespace App\Console\Commands;

use App\Models\Subscription;
use App\Services\OperationalNotifier;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

final class CheckSubscriptionExpiriesCommand extends Command
{
    protected $signature = 'subscriptions:check-expiries';

    protected $description = 'Scan active subscriptions and dispatch operational notifications for memberships about to finish date or zero remaining sessions.';

    public function handle(OperationalNotifier $notifier): int
    {
        $today = Carbon::today();
        $threeDaysLater = $today->copy()->addDays(3);

        // 1. Subscriptions expiring in the next 3 days
        $expiringSubscriptions = Subscription::query()
            // payments feeds {{amount_paid}} in the notification payload; eager-load it so the
            // per-subscription loop below does not fire one query per row.
            ->with(['member', 'plan', 'payments'])
            ->where('status', 'active')
            ->whereBetween('end_date', [$today->toDateString(), $threeDaysLater->toDateString()])
            ->get();

        foreach ($expiringSubscriptions as $subscription) {
            $notifier->subscriptionEndingSoon($subscription);
        }

        // 2. Subscriptions with 0 sessions remaining
        $exhaustedSubscriptions = Subscription::query()
            // payments feeds {{amount_paid}} in the notification payload; eager-load it so the
            // per-subscription loop below does not fire one query per row.
            ->with(['member', 'plan', 'payments'])
            ->where('status', 'active')
            ->whereNotNull('sessions_total')
            ->where('sessions_total', '>', 0)
            ->where('sessions_remaining', 0)
            ->get();

        foreach ($exhaustedSubscriptions as $subscription) {
            $notifier->subscriptionSessionsFinished($subscription);
        }

        $this->info("Checked exipires: {$expiringSubscriptions->count()} ending soon, {$exhaustedSubscriptions->count()} sessions finished.");

        return self::SUCCESS;
    }
}
