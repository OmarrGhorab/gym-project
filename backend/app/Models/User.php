<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, HasRoles, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * Explicit allowlist — $guarded = [] is forbidden by the Constitution.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * Tokens and credentials must never be exposed in API responses.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    // -------------------------------------------------------------------------
    // Relations
    // -------------------------------------------------------------------------

    /**
     * Subscriptions sold by this user (via sold_by_user_id FK on subscriptions).
     *
     * The Subscription model is defined in Phase 1 (US3, T044). This relation
     * is declared here now so the User model is ready when subscriptions are
     * introduced, without requiring a model-level change in a later story.
     *
     * Why sold_by_user_id → users (not employees)?
     * The integration map mandates that sold_by_user_id references users
     * directly; Phase 3 (commissions) links via employees.user_id + backfill.
     *
     * @return HasMany<Subscription>
     */
    public function subscriptionsSold(): HasMany
    {
        return $this->hasMany(Subscription::class, 'sold_by_user_id');
    }

    /**
     * Sales completed by this user (via sold_by_user_id FK on sales).
     *
     * @return HasMany<Sale>
     */
    public function salesSold(): HasMany
    {
        return $this->hasMany(Sale::class, 'sold_by_user_id');
    }

    /**
     * Get the employee profile associated with the user.
     *
     * @return HasOne<Employee>
     */
    public function employee(): HasOne
    {
        return $this->hasOne(Employee::class);
    }
}
