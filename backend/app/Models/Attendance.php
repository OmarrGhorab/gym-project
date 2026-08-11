<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Spatie\Activitylog\Models\Concerns\LogsActivity;
use Spatie\Activitylog\Support\LogOptions;

class Attendance extends Model
{
    use HasFactory;
    use LogsActivity;

    protected $table = 'attendance';

    protected $fillable = [
        'employee_id',
        'shift_id',
        'date',
        'check_in',
        'check_in_latitude',
        'check_in_longitude',
        'check_in_accuracy_meters',
        'check_in_distance_meters',
        'check_in_location_status',
        'check_out',
        'check_out_latitude',
        'check_out_longitude',
        'check_out_accuracy_meters',
        'check_out_distance_meters',
        'check_out_location_status',
        'status',
        'scan_method',
        'notes',
    ];

    protected $casts = [
        'date' => 'date',
        'check_in' => 'datetime:H:i',
        'check_out' => 'datetime:H:i',
    ];

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->useLogName('attendance');
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function shift(): BelongsTo
    {
        return $this->belongsTo(EmployeeShift::class, 'shift_id');
    }
}
