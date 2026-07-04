<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Spatie\Activitylog\Models\Concerns\LogsActivity;
use Spatie\Activitylog\Support\LogOptions;

class PurchaseOrder extends Model
{
    use HasFactory;
    use LogsActivity;

    protected $fillable = [
        'reference',
        'supplier_name',
        'supplier_phone',
        'ordered_at',
        'expected_at',
        'received_at',
        'status',
        'subtotal',
        'notes',
        'created_by',
        'received_by',
        'image',
    ];

    protected $casts = [
        'ordered_at' => 'date',
        'expected_at' => 'date',
        'received_at' => 'datetime',
        'subtotal' => 'decimal:2',
    ];

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->useLogName('purchase_orders');
    }

    public function items(): HasMany
    {
        return $this->hasMany(PurchaseOrderItem::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function receiver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'received_by');
    }
}
