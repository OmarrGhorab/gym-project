<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Spatie\Activitylog\Models\Concerns\LogsActivity;
use Spatie\Activitylog\Support\LogOptions;

class Commission extends Model
{
    use HasFactory;
    use LogsActivity;

    protected $table = 'commissions';

    protected $fillable = [
        'employee_id',
        'source_type',
        'source_id',
        'rate',
        'amount',
        'month',
        'status',
    ];

    protected $casts = [
        'rate' => 'decimal:4',
        'amount' => 'decimal:2',
    ];

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->useLogName('commissions');
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function source(): MorphTo
    {
        return $this->morphTo();
    }
}
