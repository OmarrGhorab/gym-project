<?php

namespace App\Actions\Dashboard;

use App\Actions\Reminders\FindExpiringSubscriptions;
use App\Models\Subscription;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Carbon;

class ListExpiringSoonSubscriptions
{
    public function __construct(
        private readonly FindExpiringSubscriptions $reminderSettings,
    ) {}

    /**
     * @return LengthAwarePaginator<int, Subscription>
     */
    public function handle(): LengthAwarePaginator
    {
        $today = Carbon::today();
        $end = $today->copy()->addDays($this->reminderSettings->reminderDays());

        return Subscription::query()
            ->with(['member', 'plan', 'soldBy', 'payments'])
            ->where('status', 'active')
            ->whereBetween('end_date', [$today->toDateString(), $end->toDateString()])
            ->orderBy('end_date')
            ->paginate(15)
            ->withQueryString();
    }
}
