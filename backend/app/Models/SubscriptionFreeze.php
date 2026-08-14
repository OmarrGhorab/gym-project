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
    public const APPROVAL_NOT_REQUIRED = 'not_required';

    public const APPROVAL_PENDING = 'pending';

    public const APPROVAL_APPROVED = 'approved';

    public const APPROVAL_DISMISSED = 'dismissed';

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
        'approval_status',
        'dismissed_by',
        'dismissed_at',
    ];

    protected function casts(): array
    {
        return [
            'freeze_start' => 'date',
            'freeze_end' => 'date',
            'resumed_on' => 'date',
            'remaining_days_at_freeze' => 'integer',
            'approved_at' => 'datetime',
            'dismissed_at' => 'datetime',
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

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function dismissedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'dismissed_by');
    }

    public function isPendingApproval(): bool
    {
        return $this->approval_status === self::APPROVAL_PENDING;
    }

    public function isEffectiveFreeze(): bool
    {
        return in_array($this->approval_status, [
            self::APPROVAL_NOT_REQUIRED,
            self::APPROVAL_APPROVED,
        ], true);
    }
}
