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
        'days',
        'reason',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'freeze_start' => 'date',
            'freeze_end' => 'date',
        ];
    }

    public function subscription(): BelongsTo
    {
        return $this->belongsTo(Subscription::class);
    }
}
