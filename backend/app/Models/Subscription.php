<?php

namespace App\Models;

use Database\Factories\SubscriptionFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Spatie\Activitylog\Models\Concerns\LogsActivity;
use Spatie\Activitylog\Support\LogOptions;

class Subscription extends Model
{
    /** @use HasFactory<SubscriptionFactory> */
    use HasFactory, LogsActivity;

    protected $fillable = [
        'member_id',
        'plan_id',
        'upgraded_from_subscription_id',
        'start_date',
        'end_date',
        'status',
        'price_paid',
        'discount',
        'cancellation_grace_days',
        'sessions_total',
        'sessions_remaining',
        'sold_by_user_id',
        'created_by',
        'last_reminded_on',
    ];

    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'end_date' => 'date',
            'last_reminded_on' => 'date',
            'price_paid' => 'decimal:2',
            'discount' => 'decimal:2',
            'cancellation_grace_days' => 'integer',
            'sessions_total' => 'integer',
            'sessions_remaining' => 'integer',
        ];
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->useLogName('subscriptions');
    }

    public function member(): BelongsTo
    {
        return $this->belongsTo(Member::class);
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class);
    }

    public function upgradedFrom(): BelongsTo
    {
        return $this->belongsTo(Subscription::class, 'upgraded_from_subscription_id');
    }

    public function soldBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sold_by_user_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function freezes(): HasMany
    {
        return $this->hasMany(SubscriptionFreeze::class);
    }

    public function payments(): MorphMany
    {
        return $this->morphMany(Payment::class, 'payable');
    }

    public function refunds(): HasMany
    {
        return $this->hasMany(SubscriptionRefund::class);
    }

    public function addons(): HasMany
    {
        return $this->hasMany(SubscriptionAddon::class);
    }

    /**
     * Exclude an older active subscription when the same member already has
     * a later active renewal. Renewal attention should follow the member's
     * latest active period, not the expiring period it replaced.
     *
     * @param  Builder<Subscription>  $query
     * @return Builder<Subscription>
     */
    public function scopeWithoutLaterActiveRenewal(Builder $query): Builder
    {
        return $query->whereNotExists(function ($subquery): void {
            $subquery
                ->selectRaw('1')
                ->from('subscriptions as later_subscriptions')
                ->whereColumn('later_subscriptions.member_id', 'subscriptions.member_id')
                ->where('later_subscriptions.status', 'active')
                ->whereColumn('later_subscriptions.end_date', '>', 'subscriptions.end_date');
        });
    }
}
