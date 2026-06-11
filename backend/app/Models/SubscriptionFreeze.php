<?php

namespace App\Models;

use Database\Factories\SubscriptionFreezeFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SubscriptionFreeze extends Model
{
    /** @use HasFactory<SubscriptionFreezeFactory> */
    use HasFactory;

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
