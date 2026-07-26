<?php

use App\Models\Plan;
use App\Models\PlanCategory;
use Database\Seeders\PlanCategorySeeder;
use Database\Seeders\PlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

/**
 * Seeders write through the model, so they bypass StorePlanRequest entirely. That
 * makes it easy to seed a plan the API itself would reject — which then shows up
 * as a plan nobody can edit, because the category picker filters by type.
 */
beforeEach(function (): void {
    $this->seed([PlanCategorySeeder::class, PlanSeeder::class]);
});

test('the plan seeder creates plans', function (): void {
    expect(Plan::query()->count())->toBeGreaterThan(0);
});

test('every seeded plan uses a category that exists', function (): void {
    $known = PlanCategory::query()->pluck('slug')->all();

    $orphans = Plan::query()
        ->whereNotIn('category', $known)
        ->pluck('category', 'name')
        ->all();

    expect($orphans)->toBe([], 'plans reference categories that do not exist: '.json_encode($orphans));
});

test('every seeded plan uses a category that belongs to its own type', function (): void {
    $typeBySlug = PlanCategory::query()->pluck('plan_type', 'slug')->all();

    $mismatched = Plan::query()
        ->get()
        ->filter(fn (Plan $plan): bool => ($typeBySlug[$plan->category] ?? null) !== $plan->type)
        ->mapWithKeys(fn (Plan $plan): array => [
            $plan->name => "type={$plan->type} category={$plan->category}",
        ])
        ->all();

    expect($mismatched)->toBe([], 'seeded plans the API would reject: '.json_encode($mismatched));
});

test('every seeded plan type is one the API accepts', function (): void {
    $unknown = Plan::query()
        ->whereNotIn('type', PlanCategory::PLAN_TYPES)
        ->pluck('type', 'name')
        ->all();

    expect($unknown)->toBe([]);
});

test('every seeded offer carries a validity window', function (): void {
    // StorePlanRequest marks valid_from/valid_to required for offer types.
    $incomplete = Plan::query()
        ->whereIn('type', ['offer', 'offer_package'])
        ->where(fn ($query) => $query->whereNull('valid_from')->orWhereNull('valid_to'))
        ->pluck('name')
        ->all();

    expect($incomplete)->toBe([]);
});

test('seeding twice does not duplicate plans', function (): void {
    $before = Plan::query()->count();

    $this->seed(PlanSeeder::class);

    expect(Plan::query()->count())->toBe($before);
});
