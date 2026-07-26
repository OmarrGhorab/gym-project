<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

final class PlanPackageItem extends Model
{
    use HasFactory;

    protected $fillable = ['package_plan_id', 'included_plan_id', 'coach_id'];

    public function packagePlan(): BelongsTo
    {
        return $this->belongsTo(Plan::class, 'package_plan_id');
    }

    public function includedPlan(): BelongsTo
    {
        return $this->belongsTo(Plan::class, 'included_plan_id');
    }

    public function coach(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }
}
