<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Spatie\Activitylog\Models\Concerns\LogsActivity;
use Spatie\Activitylog\Support\LogOptions;

class EmployeeShift extends Model
{
    use HasFactory;
    use LogsActivity;

    protected $fillable = [
        'name',
        'starts_at',
        'ends_at',
        'grace_minutes',
        'is_active',
    ];

    protected $casts = [
        'starts_at' => 'datetime:H:i',
        'ends_at' => 'datetime:H:i',
        'is_active' => 'boolean',
    ];

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->useLogName('employee_shifts');
    }

    public function employees(): HasMany
    {
        return $this->hasMany(Employee::class, 'shift_id');
    }
}
