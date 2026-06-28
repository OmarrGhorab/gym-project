<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;
use Spatie\Activitylog\Models\Concerns\LogsActivity;
use Spatie\Activitylog\Support\LogOptions;

class Employee extends Model
{
    use HasFactory;
    use LogsActivity;
    use SoftDeletes;

    protected $fillable = [
        'user_id',
        'name',
        'phone',
        'attendance_code',
        'role',
        'base_salary',
        'commission_rate',
        'shift_id',
        'hire_date',
        'status',
    ];

    protected $casts = [
        'base_salary' => 'decimal:2',
        'commission_rate' => 'decimal:4',
        'hire_date' => 'date',
    ];

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->useLogName('employees');
    }

    protected static function booted(): void
    {
        static::creating(function (Employee $employee): void {
            if (! $employee->attendance_code) {
                $employee->attendance_code = self::newAttendanceCode();
            }
        });
    }

    public static function newAttendanceCode(): string
    {
        do {
            $code = 'E-'.Str::upper(Str::random(16));
        } while (self::query()->where('attendance_code', $code)->exists());

        return $code;
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function commissions(): HasMany
    {
        return $this->hasMany(Commission::class);
    }

    public function payrolls(): HasMany
    {
        return $this->hasMany(Payroll::class);
    }

    public function shift(): BelongsTo
    {
        return $this->belongsTo(EmployeeShift::class, 'shift_id');
    }

    public function attendance(): HasMany
    {
        return $this->hasMany(Attendance::class);
    }

    /**
     * Scope a query to only include active employees.
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->where('status', 'active');
    }
}
