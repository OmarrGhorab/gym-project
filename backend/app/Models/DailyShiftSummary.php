<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DailyShiftSummary extends Model
{
    protected $fillable = [
        'business_date',
        'sent_at',
    ];

    protected function casts(): array
    {
        return [
            'business_date' => 'date',
            'sent_at' => 'datetime',
        ];
    }
}
