<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

final class PlanCategory extends Model
{
    use HasFactory;

    /**
     * The plan types a category can belong to. Kept in sync with the `type`
     * rule in StorePlanRequest / UpdatePlanRequest.
     *
     * A category belongs to exactly one of these: the vocabulary already spells
     * out the combined cases ("offer_package", "membership_extra_service"), so a
     * category spanning several types would describe a combination that is
     * itself already a type.
     */
    public const PLAN_TYPES = [
        'membership',
        'offer',
        'offer_package',
        'fitness_studio',
        'extra_service',
        'membership_extra_service',
    ];

    /**
     * Slugs that business logic branches on directly — see CreateSubscription,
     * AddSubscriptionAddon and CoachExtraPlansReport. Deactivating one of these
     * would silently change how subscriptions are priced and reported, so the
     * controller refuses to delete them.
     */
    public const SYSTEM_SLUGS = ['gym_access', 'fitness_studio'];

    /**
     * Longest slug we can store, bounded by the `plans.category` column that
     * references it.
     */
    public const SLUG_MAX_LENGTH = 40;

    /** Types that mean "this is gym floor access" rather than an add-on service. */
    private const GYM_ACCESS_TYPES = ['membership', 'offer', 'offer_package'];

    /** Types that mean "this is a standalone studio discipline". */
    private const STUDIO_TYPES = ['fitness_studio'];

    protected $fillable = [
        'name',
        'slug',
        'plan_scope',
        'plan_type',
        'description',
        'is_active',
        'is_system',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'is_system' => 'boolean',
    ];

    public static function slugFor(string $name): string
    {
        return Str::slug($name, '_');
    }

    /**
     * The coarse gym-floor / studio / add-on flag, inferred from the plan type a
     * category serves. Only used as a default — an explicitly supplied scope wins.
     */
    public static function deriveScope(?string $type): string
    {
        if (in_array($type, self::GYM_ACCESS_TYPES, true)) {
            return 'gym_access';
        }

        if (in_array($type, self::STUDIO_TYPES, true)) {
            return 'fitness_studio';
        }

        return 'extra_service';
    }

    protected static function boot(): void
    {
        parent::boot();

        self::saving(function (PlanCategory $category): void {
            if (empty($category->slug)) {
                $category->slug = self::slugFor((string) $category->name);
            }

            // A missing or unrecognised type falls back to the most common one
            // rather than leaving the category unusable everywhere.
            if (! in_array($category->plan_type, self::PLAN_TYPES, true)) {
                $category->plan_type = 'membership';
            }

            $scopeWasChosen = $category->isDirty('plan_scope') && ! empty($category->plan_scope);

            if (! $scopeWasChosen && ($category->isDirty('plan_type') || empty($category->plan_scope))) {
                $category->plan_scope = self::deriveScope($category->plan_type);
            }
        });
    }

    /**
     * Plans reference the category by slug rather than id — there is no foreign
     * key — so the relation is keyed on the slug on both sides.
     *
     * @return HasMany<Plan, $this>
     */
    public function plans(): HasMany
    {
        return $this->hasMany(Plan::class, 'category', 'slug');
    }

    public function supportsType(string $type): bool
    {
        return $this->plan_type === $type;
    }

    public function isSystem(): bool
    {
        return $this->is_system || in_array($this->slug, self::SYSTEM_SLUGS, true);
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }
}
