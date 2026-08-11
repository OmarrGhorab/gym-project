<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Spatie\Activitylog\Models\Concerns\LogsActivity;
use Spatie\Activitylog\Support\LogOptions;

class Payroll extends Model
{
    use HasFactory;
    use LogsActivity;

    protected $table = 'payroll';

    protected $fillable = [
        'employee_id',
        'month',
        'base_salary',
        'commissions_total',
        'bonuses',
        'deductions',
        'manual_bonus_reason',
        'manual_deduction_reason',
        'net_salary',
        'status',
        'paid_at',
    ];

    protected $casts = [
        'base_salary' => 'decimal:2',
        'commissions_total' => 'decimal:2',
        'bonuses' => 'decimal:2',
        'deductions' => 'decimal:2',
        'net_salary' => 'decimal:2',
        'paid_at' => 'datetime',
    ];

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->useLogName('payroll');
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }
}
