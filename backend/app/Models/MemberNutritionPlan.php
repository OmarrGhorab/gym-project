<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MemberNutritionPlan extends Model
{
    use HasFactory;

    protected $fillable = [
        'member_id',
        'coach_id',
        'title',
        'status',
        'daily_calories',
        'protein_grams',
        'carbs_grams',
        'fat_grams',
        'supplements',
        'notes',
        'created_by',
    ];

    public function member(): BelongsTo
    {
        return $this->belongsTo(Member::class);
    }

    public function coach(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'coach_id');
    }
}
