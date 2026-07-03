<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MemberProgressEntry extends Model
{
    use HasFactory;

    protected $fillable = [
        'member_id',
        'recorded_on',
        'weight_kg',
        'body_fat_percent',
        'chest_cm',
        'waist_cm',
        'hips_cm',
        'arms_cm',
        'thighs_cm',
        'notes',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'recorded_on' => 'date',
            'weight_kg' => 'decimal:2',
            'body_fat_percent' => 'decimal:2',
            'chest_cm' => 'decimal:2',
            'waist_cm' => 'decimal:2',
            'hips_cm' => 'decimal:2',
            'arms_cm' => 'decimal:2',
            'thighs_cm' => 'decimal:2',
        ];
    }

    public function member(): BelongsTo
    {
        return $this->belongsTo(Member::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
