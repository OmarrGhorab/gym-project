<?php

namespace App\Models;

use Database\Factories\SubscriptionFreezeFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Spatie\Activitylog\Models\Concerns\LogsActivity;
use Spatie\Activitylog\Support\LogOptions;

class SubscriptionFreeze extends Model
{
    /** @use HasFactory<SubscriptionFreezeFactory> */
    use HasFactory;

    use LogsActivity;

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->useLogName('subscription_freeze');
    }

    protected $fillable = [
        'subscription_id',
        'freeze_start',
        'freeze_end',
        'resumed_on',
        'days',
        'remaining_days_at_freeze',
        'reason',
        'created_by',
        'approved_by',
        'approved_at',
    ];

    protected function casts(): array
    {
        return [
            'freeze_start' => 'date',
            'freeze_end' => 'date',
            'resumed_on' => 'date',
            'remaining_days_at_freeze' => 'integer',
            'approved_at' => 'datetime',
        ];
    }

    public function subscription(): BelongsTo
    {
        return $this->belongsTo(Subscription::class);
    }

    /** Set only for plans that require sign-off before freezing. */
    public function approvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }
}
