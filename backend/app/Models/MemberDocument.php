<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MemberDocument extends Model
{
    use HasFactory;

    protected $fillable = [
        'member_id',
        'type',
        'title',
        'file_path',
        'expires_on',
        'notes',
        'created_by',
    ];

    protected function casts(): array
    {
        return ['expires_on' => 'date'];
    }

    public function member(): BelongsTo
    {
        return $this->belongsTo(Member::class);
    }
}
