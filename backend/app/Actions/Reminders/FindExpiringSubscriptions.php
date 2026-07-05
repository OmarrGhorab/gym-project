<?php

namespace App\Actions\Reminders;

use App\Models\Setting;
use App\Models\Subscription;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Carbon;

class FindExpiringSubscriptions
{
    /**
     * @return Collection<int, Subscription>
     */
    public function handle(): Collection
    {
        return $this->query()->get();
    }

    /**
     * @return Builder<Subscription>
     */
    public function query(): Builder
    {
        $days = $this->reminderDays();
        $today = Carbon::today();
        $end = $today->copy()->addDays($days);

        return Subscription::query()
            ->with(['member', 'soldBy'])
            ->where('status', 'active')
            ->withoutLaterActiveRenewal()
            ->whereBetween('end_date', [$today->toDateString(), $end->toDateString()])
            ->where(function ($query) use ($today): void {
                $query->whereNull('last_reminded_on')
                    ->orWhereDate('last_reminded_on', '<', $today->toDateString());
            });
    }

    public function reminderDays(): int
    {
        $setting = Setting::query()->where('key', 'reminder_days')->first();

        if (! $setting) {
            return 7;
        }

        $value = $setting->value;

        if (is_array($value)) {
            return (int) ($value['value'] ?? 7);
        }

        return (int) $value;
    }
}
