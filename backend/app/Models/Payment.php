<?php

namespace App\Models;

use Database\Factories\PaymentFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Spatie\Activitylog\Models\Concerns\LogsActivity;
use Spatie\Activitylog\Support\LogOptions;

class Payment extends Model
{
    /** @use HasFactory<PaymentFactory> */
    use HasFactory, LogsActivity;

    /** Statuses that affect collected revenue (refunds use negative amounts). */
    public const REVENUE_STATUSES = ['paid', 'partial', 'refunded'];

    /** Statuses that represent money collected toward a payable (exclude refunds). */
    public const COLLECTED_STATUSES = ['paid', 'partial'];

    public const STATUS_REFUNDED = 'refunded';

    protected $fillable = [
        'payable_type',
        'payable_id',
        'amount',
        'method',
        'status',
        'paid_at',
        'due_date',
        'created_by',
        'shift_session_id',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'paid_at' => 'datetime',
            'due_date' => 'date',
        ];
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->useLogName('payments');
    }

    public function payable(): MorphTo
    {
        return $this->morphTo();
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Payments that count toward net revenue (collections + refunds as negatives).
     *
     * @param  Builder<static>  $query
     * @return Builder<static>
     */
    public function scopeRevenue($query)
    {
        return $query->whereIn('status', self::REVENUE_STATUSES);
    }

    /**
     * Payments that count as money collected (excludes refund rows).
     *
     * @param  Builder<static>  $query
     * @return Builder<static>
     */
    public function scopeCollected($query)
    {
        return $query->whereIn('status', self::COLLECTED_STATUSES);
    }
}
