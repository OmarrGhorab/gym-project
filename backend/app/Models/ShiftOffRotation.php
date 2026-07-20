<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Spatie\Activitylog\Models\Concerns\LogsActivity;
use Spatie\Activitylog\Support\LogOptions;

class ShiftOffRotation extends Model
{
    use LogsActivity;

    protected $fillable = [
        'employee_shift_id',
        'off_weekday',
        'rotation_start_date',
        'employee_order',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'off_weekday' => 'integer',
            'rotation_start_date' => 'date',
            'employee_order' => 'array',
            'is_active' => 'boolean',
        ];
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->useLogName('shift_off_rotations');
    }

    public function shift(): BelongsTo
    {
        return $this->belongsTo(EmployeeShift::class, 'employee_shift_id');
    }
}
