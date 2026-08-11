<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Spatie\Activitylog\Models\Concerns\LogsActivity;
use Spatie\Activitylog\Support\LogOptions;

/**
 * A named block of the working day — "Morning", "Evening" — and nothing more.
 *
 * Shifts carry no times: staff clock in and out whenever they actually arrive
 * and leave. The name exists so the cash desk can say which block a drawer
 * belongs to and so attendance can be grouped by it.
 */
class EmployeeShift extends Model
{
    use HasFactory;
    use LogsActivity;

    protected $fillable = [
        'name',
        'is_active',
    ];

    protected $casts = [
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

    public function sessions(): HasMany
    {
        return $this->hasMany(ShiftSession::class, 'employee_shift_id');
    }
}
