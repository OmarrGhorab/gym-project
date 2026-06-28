<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AttendanceViolation extends Model
{
    use HasFactory;

    protected $fillable = [
        'employee_id',
        'attendance_id',
        'attendance_violation_rule_id',
        'payroll_id',
        'violation_date',
        'type',
        'minutes',
        'deduction_days',
        'deduction_amount',
        'status',
        'notes',
        'reviewed_by',
        'reviewed_at',
    ];

    protected $casts = [
        'violation_date' => 'date',
        'deduction_days' => 'decimal:2',
        'deduction_amount' => 'decimal:2',
        'reviewed_at' => 'datetime',
    ];

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function attendance(): BelongsTo
    {
        return $this->belongsTo(Attendance::class);
    }

    public function rule(): BelongsTo
    {
        return $this->belongsTo(AttendanceViolationRule::class, 'attendance_violation_rule_id');
    }

    public function payroll(): BelongsTo
    {
        return $this->belongsTo(Payroll::class);
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }
}
