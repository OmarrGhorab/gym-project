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
        'sessions_count',
        'type',
        'is_active',
        'valid_from',
        'valid_to',
        'max_freeze_days',
        'commission_rate',
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'is_active' => 'boolean',
        'valid_from' => 'date',
        'valid_to' => 'date',
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
}
