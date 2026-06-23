<?php

namespace App\Models;

use Database\Factories\MemberFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Spatie\Activitylog\Models\Concerns\LogsActivity;
use Spatie\Activitylog\Support\LogOptions;

class Member extends Model
{
    /** @use HasFactory<MemberFactory> */
    use HasFactory, LogsActivity;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'phone',
        'email',
        'gender',
        'birth_date',
        'photo_path',
        'national_id',
        'join_date',
        'status',
        'notes',
        'created_by',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'birth_date' => 'date',
            'join_date' => 'date',
        ];
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->useLogName('members')
            ->logOnly(['status', 'created_by'])
            ->logOnlyDirty()
            ->dontLogEmptyChanges();
    }

    // -------------------------------------------------------------------------
    // Relations
    // -------------------------------------------------------------------------

    /**
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * @return HasMany<Subscription, $this>
     */
    public function subscriptions(): HasMany
    {
        return $this->hasMany(Subscription::class);
    }

    /**
     * @return HasOne<Subscription, $this>
     */
    public function latestSubscription(): HasOne
    {
        return $this->hasOne(Subscription::class)->latestOfMany();
    }

    /**
     * @return HasMany<Sale, $this>
     */
    public function sales(): HasMany
    {
        return $this->hasMany(Sale::class);
    }

    /**
     * Scope to include total_paid as a computed column via subquery.
     */
    public function scopeWithTotalPaid($query)
    {
        return $query->select('members.*')
            ->selectSub(
                Payment::query()
                    ->selectRaw('COALESCE(SUM(payments.amount), 0)')
                    ->join('subscriptions', function ($join): void {
                        $join->on('subscriptions.id', '=', 'payments.payable_id')
                            ->where('payments.payable_type', '=', Subscription::class);
                    })
                    ->whereColumn('subscriptions.member_id', 'members.id'),
                'total_paid',
            );
    }
}
