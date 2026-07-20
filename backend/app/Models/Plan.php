<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;
use Spatie\Activitylog\Models\Concerns\LogsActivity;
use Spatie\Activitylog\Support\LogOptions;

final class Plan extends Model
{
    use HasFactory;
    use LogsActivity;

    protected $fillable = [
        'name',
        'description',
        'price',
        'duration_days',
        'duration_months',
        'sessions_count',
        'is_unlimited_sessions',
        'type',
        'category',
        'is_active',
        'valid_from',
        'valid_to',
        'access_starts_at',
        'access_ends_at',
        'max_freeze_days',
        'access_grace_days',
        'cancellation_grace_days',
        'min_freeze_days',
        'freeze_requires_approval',
        'commission_rate',
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'is_unlimited_sessions' => 'boolean',
        'is_active' => 'boolean',
        'valid_from' => 'date',
        'valid_to' => 'date',
        'freeze_requires_approval' => 'boolean',
        'commission_rate' => 'decimal:4',
    ];

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->useLogName('plans');
    }

    public function subscriptions(): HasMany
    {
        return $this->hasMany(Subscription::class);
    }

    public function subscriptionAddons(): HasMany
    {
        return $this->hasMany(SubscriptionAddon::class);
    }

    public function employeeCommissionRules(): HasMany
    {
        return $this->hasMany(EmployeePlanCommissionRule::class);
    }

    public function endDateFrom(Carbon $startDate): Carbon
    {
        if ((int) ($this->duration_months ?? 0) > 0) {
            return $startDate->copy()->addMonthsNoOverflow((int) $this->duration_months);
        }

        return $startDate->copy()->addDays((int) $this->duration_days);
    }

    /**
     * A plan is sellable when active and within its optional validity window.
     * Re-checked at subscription creation (FR-008).
     */
    public function isSellable(): bool
    {
        if (! $this->is_active) {
            return false;
        }

        $today = Carbon::today();

        if ($this->valid_from !== null && $this->valid_from->gt($today)) {
            return false;
        }

        if ($this->valid_to !== null && $this->valid_to->lt($today)) {
            return false;
        }

        return true;
    }

    /**
     * Whether a check-in timestamp falls inside the plan's daily access window.
     * Null start/end means all-day access. Supports overnight windows (e.g. 22:00–06:00).
     */
    public function allowsAccessAt(Carbon $time): bool
    {
        if ($this->access_starts_at === null || $this->access_ends_at === null) {
            return true;
        }

        $startsAt = $this->parseClock((string) $this->access_starts_at);
        $endsAt = $this->parseClock((string) $this->access_ends_at);

        if ($startsAt === null || $endsAt === null) {
            return true;
        }

        $visitSeconds = ($time->hour * 3600) + ($time->minute * 60) + $time->second;
        $startSeconds = ($startsAt->hour * 3600) + ($startsAt->minute * 60) + $startsAt->second;
        $endSeconds = ($endsAt->hour * 3600) + ($endsAt->minute * 60) + $endsAt->second;

        if ($startSeconds <= $endSeconds) {
            return $visitSeconds >= $startSeconds && $visitSeconds <= $endSeconds;
        }

        // Overnight window: e.g. 22:00–06:00
        return $visitSeconds >= $startSeconds || $visitSeconds <= $endSeconds;
    }

    private function parseClock(string $value): ?Carbon
    {
        $value = trim($value);

        if ($value === '') {
            return null;
        }

        // MySQL time / Carbon string may be "19:00:00" or "19:00"
        foreach (['H:i:s', 'H:i'] as $format) {
            try {
                $parsed = Carbon::createFromFormat($format, strlen($value) === 5 && $format === 'H:i:s' ? $value.':00' : $value);

                if ($parsed instanceof Carbon) {
                    return $parsed;
                }
            } catch (\Throwable) {
                // try next format
            }
        }

        try {
            return Carbon::parse($value);
        } catch (\Throwable) {
            return null;
        }
    }
}
