<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DailyAttendanceReport extends Model
{
    protected $fillable = [
        'business_date',
        'file_path',
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
