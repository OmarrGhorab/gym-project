<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AttendanceViolationRule extends Model
{
    use HasFactory;

    protected $fillable = [
        'code',
        'name',
        'description',
        'threshold_minutes',
        'warning_count_before_deduction',
        'deduction_days',
        'requires_admin_approval',
        'auto_apply_if_unreviewed',
        'is_active',
    ];

    protected $casts = [
        'deduction_days' => 'decimal:2',
        'warning_count_before_deduction' => 'integer',
        'requires_admin_approval' => 'boolean',
        'auto_apply_if_unreviewed' => 'boolean',
        'is_active' => 'boolean',
    ];

    public function violations(): HasMany
    {
        return $this->hasMany(AttendanceViolation::class);
    }
}
