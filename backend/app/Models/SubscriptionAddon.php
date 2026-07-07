<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Spatie\Activitylog\Models\Concerns\LogsActivity;
use Spatie\Activitylog\Support\LogOptions;

class SubscriptionAddon extends Model
{
    use HasFactory;
    use LogsActivity;

    protected $fillable = [
        'subscription_id',
        'member_id',
        'plan_id',
        'coach_id',
        'start_date',
        'end_date',
        'status',
        'price_paid',
        'discount',
        'sessions_total',
        'sessions_remaining',
        'sold_by_user_id',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'end_date' => 'date',
            'price_paid' => 'decimal:2',
            'discount' => 'decimal:2',
            'sessions_total' => 'integer',
            'sessions_remaining' => 'integer',
        ];
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->useLogName('subscription_addons');
    }

    public function subscription(): BelongsTo
    {
        return $this->belongsTo(Subscription::class);
    }

    public function member(): BelongsTo
    {
        return $this->belongsTo(Member::class);
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class);
    }

    public function coach(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'coach_id');
    }

    public function payments(): MorphMany
    {
        return $this->morphMany(Payment::class, 'payable');
    }
}
