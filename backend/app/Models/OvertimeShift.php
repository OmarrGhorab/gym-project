<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Spatie\Activitylog\Models\Concerns\LogsActivity;
use Spatie\Activitylog\Support\LogOptions;

/**
 * An extra shift worked by an employee covering for an absent colleague.
 *
 * The bonus is deliberately NOT fed into payroll automatically: an admin
 * approves it with a hand-entered amount, adds it to the salary, then marks
 * the record settled.
 */
class OvertimeShift extends Model
{
    use HasFactory;
    use LogsActivity;

    public const STATUS_PENDING = 'pending';

    public const STATUS_APPROVED = 'approved';

    public const STATUS_REJECTED = 'rejected';

    public const STATUS_SETTLED = 'settled';

    public const STATUSES = [
        self::STATUS_PENDING,
        self::STATUS_APPROVED,
        self::STATUS_REJECTED,
        self::STATUS_SETTLED,
    ];

    protected $fillable = [
        'employee_id',
        'covering_for_employee_id',
        'employee_shift_id',
        'date',
        'starts_at',
        'ends_at',
        'hours',
        'bonus_amount',
        'status',
        'notes',
        'created_by',
        'reviewed_by',
        'reviewed_at',
        'settled_by',
        'settled_at',
    ];

    protected function casts(): array
    {
        return [
            'date' => 'date',
            'starts_at' => 'datetime:H:i',
            'ends_at' => 'datetime:H:i',
            'hours' => 'decimal:2',
            'bonus_amount' => 'decimal:2',
            'reviewed_at' => 'datetime',
            'settled_at' => 'datetime',
        ];
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->useLogName('overtime_shifts');
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function coveringFor(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'covering_for_employee_id');
    }

    public function shift(): BelongsTo
    {
        return $this->belongsTo(EmployeeShift::class, 'employee_shift_id');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function reviewedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function settledBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'settled_by');
    }

    /** Records that still occupy a shift slot — a rejected claim frees the slot again. */
    public function scopeActiveClaim(Builder $query): Builder
    {
        return $query->whereIn('status', [self::STATUS_PENDING, self::STATUS_APPROVED, self::STATUS_SETTLED]);
    }
}
