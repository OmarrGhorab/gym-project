<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Ties each category to the one plan type it belongs to, so the plan form can show
 * only the categories that make sense for the selected type.
 *
 * One type, not a list: the plan type vocabulary already spells out the combined
 * cases ("Offer package", "Membership + extra service"), so a category that spanned
 * several types would be describing a combination that is itself already a type.
 *
 * `plan_scope` stays: it is the coarser gym-floor / studio / add-on flag the plan
 * form still uses to decide whether to show the coach commission editor.
 */
return new class extends Migration
{
    private const SCOPE_TO_TYPE = [
        'gym_access' => 'membership',
        'fitness_studio' => 'fitness_studio',
        'extra_service' => 'extra_service',
    ];

    /**
     * Business logic keys on these slugs directly (CreateSubscription,
     * AddSubscriptionAddon, CoachExtraPlansReport), so they must not be deletable.
     */
    private const SYSTEM_SLUGS = ['gym_access', 'fitness_studio'];

    public function up(): void
    {
        Schema::table('plan_categories', function (Blueprint $table): void {
            $table->string('plan_type', 30)->default('membership')->after('plan_scope')->index();
            $table->boolean('is_system')->default(false)->after('is_active');
        });

        $this->backfillExistingCategories();
        $this->adoptCategoriesReferencedByPlans();
    }

    public function down(): void
    {
        Schema::table('plan_categories', function (Blueprint $table): void {
            // SQLite refuses to drop a column an index still points at, so the
            // index has to go first. MySQL would cascade, but this works on both.
            $table->dropIndex(['plan_type']);
        });

        Schema::table('plan_categories', function (Blueprint $table): void {
            $table->dropColumn(['plan_type', 'is_system']);
        });
    }

    /**
     * Prefer the type the category is actually paired with in real plans, falling
     * back to the scope it was created with.
     */
    private function backfillExistingCategories(): void
    {
        foreach (DB::table('plan_categories')->get() as $category) {
            $type = $this->mostUsedTypeFor($category->slug)
                ?? self::SCOPE_TO_TYPE[$category->plan_scope]
                ?? 'membership';

            DB::table('plan_categories')
                ->where('id', $category->id)
                ->update([
                    'plan_type' => $type,
                    'is_system' => in_array($category->slug, self::SYSTEM_SLUGS, true),
                ]);
        }
    }

    /**
     * Plans reference categories by slug and, until now, nothing kept the two in
     * sync — the lookup table was never even seeded. Any slug already in use but
     * missing from the table would fail the new validation rule and leave its plan
     * uneditable, so adopt those slugs before that rule lands.
     */
    private function adoptCategoriesReferencedByPlans(): void
    {
        if (! Schema::hasTable('plans')) {
            return;
        }

        $known = DB::table('plan_categories')->pluck('slug')->all();

        $orphans = DB::table('plans')
            ->whereNotNull('category')
            ->where('category', '!=', '')
            ->whereNotIn('category', $known)
            ->distinct()
            ->pluck('category');

        foreach ($orphans as $slug) {
            DB::table('plan_categories')->insert([
                'name' => Str::title(str_replace('_', ' ', (string) $slug)),
                'slug' => $slug,
                'plan_scope' => 'extra_service',
                'plan_type' => $this->mostUsedTypeFor($slug) ?? 'membership',
                'description' => null,
                'is_active' => true,
                'is_system' => false,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    /**
     * The plan type this category is paired with most often, or null if no plan uses it.
     */
    private function mostUsedTypeFor(string $slug): ?string
    {
        if (! Schema::hasTable('plans')) {
            return null;
        }

        $row = DB::table('plans')
            ->select('type', DB::raw('count(*) as total'))
            ->where('category', $slug)
            ->whereNotNull('type')
            ->groupBy('type')
            ->orderByDesc('total')
            ->first();

        return $row->type ?? null;
    }
};
