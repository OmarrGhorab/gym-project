<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Spatie\Activitylog\Models\Concerns\LogsActivity;
use Spatie\Activitylog\Support\LogOptions;

class ShiftSession extends Model
{
    use LogsActivity;

    public const STATUS_OPEN = 'open';

    public const STATUS_PENDING_HANDOVER = 'pending_handover';

    public const STATUS_PENDING_ADMIN = 'pending_admin';

    public const STATUS_ACCEPTED = 'accepted';

    public const STATUS_DISPUTED = 'disputed';

    public const STATUS_AUTO_ACCEPTED = 'auto_accepted';

    protected $fillable = [
        'employee_shift_id',
        'business_date',
        'opened_at',
        'closed_at',
        'opened_by',
        'opened_by_employee_id',
        'closed_by',
        'closed_by_employee_id',
        'status',
        'opening_float',
        'expected_cash',
        'expected_card',
        'expected_bank',
        'expected_expenses',
        'expected_net',
        'counted_cash',
        'counted_card',
        'counted_bank',
        'counted_expenses',
        'received_by',
        'variance_notes',
        'admin_reviewed_by',
        'admin_reviewed_at',
        'admin_decision',
        'previous_session_id',
    ];

    protected function casts(): array
    {
        return [
            'business_date' => 'date',
            'opened_at' => 'datetime',
            'closed_at' => 'datetime',
            'admin_reviewed_at' => 'datetime',
            'opening_float' => 'decimal:2',
            'expected_cash' => 'decimal:2',
            'expected_card' => 'decimal:2',
            'expected_bank' => 'decimal:2',
            'expected_expenses' => 'decimal:2',
            'expected_net' => 'decimal:2',
            'counted_cash' => 'decimal:2',
            'counted_card' => 'decimal:2',
            'counted_bank' => 'decimal:2',
            'counted_expenses' => 'decimal:2',
        ];
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->useLogName('shift_sessions');
    }

    public function shift(): BelongsTo
    {
        return $this->belongsTo(EmployeeShift::class, 'employee_shift_id');
    }

    public function openedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'opened_by');
    }

    public function closedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'closed_by');
    }

    /** Employee of this shift who is accountable for the drawer. */
    public function openedByEmployee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'opened_by_employee_id');
    }

    public function closedByEmployee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'closed_by_employee_id');
    }

    public function receivedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'received_by');
    }

    public function adminReviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'admin_reviewed_by');
    }

    public function previousSession(): BelongsTo
    {
        return $this->belongsTo(self::class, 'previous_session_id');
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function expenses(): HasMany
    {
        return $this->hasMany(Expense::class);
    }

    public function isResolved(): bool
    {
        return in_array($this->status, [self::STATUS_ACCEPTED, self::STATUS_AUTO_ACCEPTED], true);
    }
}
