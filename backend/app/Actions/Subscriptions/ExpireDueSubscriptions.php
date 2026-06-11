<?php

namespace App\Actions\Subscriptions;

use App\Models\Subscription;
use Illuminate\Support\Carbon;

class ExpireDueSubscriptions
{
    public function handle(): int
    {
        return Subscription::query()
            ->where('status', 'active')
            ->whereDate('end_date', '<', Carbon::today()->toDateString())
            ->update(['status' => 'expired']);
    }
}
