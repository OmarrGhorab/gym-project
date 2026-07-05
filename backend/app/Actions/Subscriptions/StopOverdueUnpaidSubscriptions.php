<?php

namespace App\Actions\Subscriptions;

use App\Models\Subscription;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class StopOverdueUnpaidSubscriptions
{
    public function handle(?Carbon $today = null): int
    {
        $today ??= Carbon::today();
        $count = 0;

        Subscription::query()
            ->with(['plan', 'payments'])
            ->where('status', 'active')
            ->chunkById(100, function ($subscriptions) use (&$count, $today): void {
                foreach ($subscriptions as $subscription) {
                    if (! $this->shouldStop($subscription, $today)) {
                        continue;
                    }

                    DB::transaction(function () use ($subscription): void {
                        Subscription::query()
                            ->whereKey($subscription->id)
                            ->where('status', 'active')
                            ->update(['status' => 'stopped']);
                    });

                    $count++;
                }
            });

        return $count;
    }

    private function shouldStop(Subscription $subscription, Carbon $today): bool
    {
        $graceDays = (int) ($subscription->plan?->access_grace_days ?? 0);
        $paidTotal = $subscription->payments->reduce(
            fn (string $carry, $payment): string => bcadd($carry, (string) $payment->amount, 2),
            '0.00',
        );

        if (bccomp($paidTotal, (string) $subscription->price_paid, 2) >= 0) {
            return false;
        }

        $dueDate = $subscription->payments
            ->filter(fn ($payment): bool => $payment->due_date !== null)
            ->min('due_date');

        $dueDate = $dueDate !== null
            ? Carbon::parse($dueDate)->startOfDay()
            : $subscription->start_date?->copy()->startOfDay();

        if ($dueDate === null) {
            return false;
        }

        return $dueDate->copy()->addDays($graceDays)->lt($today->startOfDay());
    }
}
