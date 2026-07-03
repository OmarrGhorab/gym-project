<?php

namespace App\Models;

use Database\Factories\MemberFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;
use Spatie\Activitylog\Models\Concerns\LogsActivity;
use Spatie\Activitylog\Support\LogOptions;

class Member extends Model
{
    /** @use HasFactory<MemberFactory> */
    use HasFactory, LogsActivity, SoftDeletes;

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
        'emergency_contact_name',
        'emergency_contact_phone',
        'attendance_code',
        'join_date',
        'status',
        'notes',
        'goals',
        'injuries',
        'medical_notes',
        'tags',
        'coach_id',
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
            'tags' => 'array',
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

    protected static function booted(): void
    {
        static::creating(function (Member $member): void {
            if (! $member->attendance_code) {
                $member->attendance_code = self::newAttendanceCode();
            }
        });
    }

    public static function newAttendanceCode(): string
    {
        do {
            $code = 'M-'.Str::upper(Str::random(16));
        } while (self::query()->where('attendance_code', $code)->exists());

        return $code;
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

    public function coach(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'coach_id');
    }

    public function progressEntries(): HasMany
    {
        return $this->hasMany(MemberProgressEntry::class);
    }

    public function workoutPlans(): HasMany
    {
        return $this->hasMany(MemberWorkoutPlan::class);
    }

    public function nutritionPlans(): HasMany
    {
        return $this->hasMany(MemberNutritionPlan::class);
    }

    public function documents(): HasMany
    {
        return $this->hasMany(MemberDocument::class);
    }

    public function bookings(): HasMany
    {
        return $this->hasMany(MemberBooking::class);
    }
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
     * @return HasMany<MemberVisit, $this>
     */
    public function visits(): HasMany
    {
        return $this->hasMany(MemberVisit::class);
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

