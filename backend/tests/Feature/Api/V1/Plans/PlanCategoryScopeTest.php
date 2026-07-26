<?php

use App\Models\Plan;
use App\Models\PlanCategory;
use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\MembershipAccessSeeder;
use Database\Seeders\PlanCategorySeeder;
use Database\Seeders\RoleMatrixSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed([
        FoundationAccessSeeder::class,
        MembershipAccessSeeder::class,
        RoleMatrixSeeder::class,
        PlanCategorySeeder::class,
    ]);
});

function planAdmin(): User
{
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);

    return $admin;
}

// ─── Categories are scoped to plan types ────────────────────────────────────

test('category list can be filtered to the plan types it serves', function (): void {
    $response = $this->actingAs(planAdmin(), 'sanctum')
        ->getJson('/api/v1/plan-categories?type=fitness_studio');

    $response->assertOk();

    $slugs = collect($response->json('data'))->pluck('slug')->all();

    expect($slugs)->toContain('fitness_studio', 'jiu_jitsu')
        ->and($slugs)->not->toContain('gym_access', 'personal_training');

    // The filter is exhaustive, not just a contains-check.
    expect($slugs)->toEqualCanonicalizing(['fitness_studio', 'jiu_jitsu']);
});

test('a category belongs to exactly one plan type', function (): void {
    $gymAccess = PlanCategory::query()->where('slug', 'gym_access')->firstOrFail();

    expect($gymAccess->plan_type)->toBe('membership')
        ->and($gymAccess->supportsType('membership'))->toBeTrue()
        ->and($gymAccess->supportsType('offer'))->toBeFalse()
        ->and($gymAccess->supportsType('fitness_studio'))->toBeFalse();
});

test('every plan type has at least one category out of the box', function (): void {
    // Otherwise a type would open the plan form with an empty category picker and
    // no way to save.
    foreach (PlanCategory::PLAN_TYPES as $type) {
        $response = $this->actingAs(planAdmin(), 'sanctum')
            ->getJson("/api/v1/plan-categories?type={$type}");

        expect($response->json('data'))->not->toBeEmpty("no category seeded for type {$type}");
    }
});

test('a plan is rejected when its category does not serve that plan type', function (): void {
    $response = $this->actingAs(planAdmin(), 'sanctum')
        ->postJson('/api/v1/plans', [
            'name' => 'Mismatched plan',
            'price' => 500,
            'duration_days' => 30,
            'is_unlimited_sessions' => true,
            'type' => 'membership',
            'category' => 'jiu_jitsu', // fitness_studio only
        ]);

    $response->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed');

    expect($response->json('error.details.category.0'))
        ->toContain('not available for this plan type');
});

test('a plan is rejected when its category does not exist', function (): void {
    $this->actingAs(planAdmin(), 'sanctum')
        ->postJson('/api/v1/plans', [
            'name' => 'Ghost category plan',
            'price' => 500,
            'duration_days' => 30,
            'is_unlimited_sessions' => true,
            'type' => 'membership',
            'category' => 'category_that_was_never_created',
        ])
        ->assertStatus(422);
});

test('a plan is rejected when its category has been retired', function (): void {
    PlanCategory::query()->where('slug', 'recovery')->update(['is_active' => false]);

    $this->actingAs(planAdmin(), 'sanctum')
        ->postJson('/api/v1/plans', [
            'name' => 'Retired category plan',
            'price' => 500,
            'duration_days' => 30,
            'is_unlimited_sessions' => true,
            'type' => 'extra_service',
            'category' => 'recovery',
        ])
        ->assertStatus(422);
});

test('retiring a category does not lock the plans already using it', function (): void {
    $plan = Plan::factory()->create(['category' => 'recovery', 'type' => 'extra_service']);
    PlanCategory::query()->where('slug', 'recovery')->update(['is_active' => false]);

    // Renaming the plan must still work — otherwise deactivating a category would
    // make every plan on it permanently uneditable, including toggling it off.
    $this->actingAs(planAdmin(), 'sanctum')
        ->putJson("/api/v1/plans/{$plan->id}", [
            'name' => 'Renamed after retirement',
            'price' => 400,
            'duration_days' => 30,
            'is_unlimited_sessions' => true,
            'type' => 'extra_service',
            'category' => 'recovery',
        ])
        ->assertOk()
        ->assertJsonPath('data.name', 'Renamed after retirement');
});

// ─── Admin-managed categories ───────────────────────────────────────────────

test('admin can create a category scoped to a plan type', function (): void {
    $response = $this->actingAs(planAdmin(), 'sanctum')
        ->postJson('/api/v1/plan-categories', [
            'name' => 'Muay Thai',
            'plan_type' => 'fitness_studio',
        ]);

    $response->assertCreated()
        ->assertJsonPath('data.slug', 'muay_thai')
        ->assertJsonPath('data.plan_type', 'fitness_studio');

    // And it is immediately usable for one of those types...
    $this->actingAs(planAdmin(), 'sanctum')
        ->postJson('/api/v1/plans', [
            'name' => 'Muay Thai Monthly',
            'price' => 900,
            'duration_days' => 30,
            'is_unlimited_sessions' => true,
            'type' => 'fitness_studio',
            'category' => 'muay_thai',
        ])
        ->assertCreated();

    // ...and refused for any other type.
    $this->actingAs(planAdmin(), 'sanctum')
        ->postJson('/api/v1/plans', [
            'name' => 'Muay Thai Membership',
            'price' => 900,
            'duration_days' => 30,
            'is_unlimited_sessions' => true,
            'type' => 'membership',
            'category' => 'muay_thai',
        ])
        ->assertStatus(422);
});

test('a category created without a type defaults to membership', function (): void {
    $this->actingAs(planAdmin(), 'sanctum')
        ->postJson('/api/v1/plan-categories', ['name' => 'Open Category'])
        ->assertCreated()
        ->assertJsonPath('data.plan_type', 'membership');
});

test('a category cannot be created with an unknown plan type', function (): void {
    $this->actingAs(planAdmin(), 'sanctum')
        ->postJson('/api/v1/plan-categories', ['name' => 'Bogus', 'plan_type' => 'not_a_type'])
        ->assertStatus(422);
});

test('admin can re-scope an existing category', function (): void {
    $category = PlanCategory::query()->where('slug', 'nutrition')->firstOrFail();

    $this->actingAs(planAdmin(), 'sanctum')
        ->putJson("/api/v1/plan-categories/{$category->id}", [
            'name' => 'Nutrition & Diet',
            'plan_type' => 'membership',
        ])
        ->assertOk()
        ->assertJsonPath('data.name', 'Nutrition & Diet')
        ->assertJsonPath('data.plan_type', 'membership')
        // The slug must survive a rename: plans reference it with no foreign key.
        ->assertJsonPath('data.slug', 'nutrition');
});

test('a category slug cannot be changed out from under the plans using it', function (): void {
    $category = PlanCategory::query()->where('slug', 'nutrition')->firstOrFail();

    $this->actingAs(planAdmin(), 'sanctum')
        ->putJson("/api/v1/plan-categories/{$category->id}", [
            'name' => 'Nutrition',
            'slug' => 'something_else',
        ])
        ->assertOk();

    expect($category->fresh()->slug)->toBe('nutrition');
});

test('admin can retire a custom category', function (): void {
    $category = PlanCategory::query()->where('slug', 'recovery')->firstOrFail();

    $this->actingAs(planAdmin(), 'sanctum')
        ->deleteJson("/api/v1/plan-categories/{$category->id}")
        ->assertNoContent();

    expect($category->fresh()->is_active)->toBeFalse();
});

test('built-in categories cannot be removed', function (): void {
    $category = PlanCategory::query()->where('slug', 'gym_access')->firstOrFail();

    $this->actingAs(planAdmin(), 'sanctum')
        ->deleteJson("/api/v1/plan-categories/{$category->id}")
        ->assertStatus(422);

    // Subscription pricing branches on this slug, so it must stay live.
    expect($category->fresh()->is_active)->toBeTrue();
});

test('the category list reports how many plans use each category', function (): void {
    Plan::factory()->count(3)->create(['category' => 'gym_access']);

    $response = $this->actingAs(planAdmin(), 'sanctum')
        ->getJson('/api/v1/plan-categories');

    $gymAccess = collect($response->json('data'))->firstWhere('slug', 'gym_access');

    expect($gymAccess['plans_count'])->toBe(3);
});

test('retired categories are hidden from the plan form but visible to the manager', function (): void {
    PlanCategory::query()->where('slug', 'recovery')->update(['is_active' => false]);

    $visible = $this->actingAs(planAdmin(), 'sanctum')->getJson('/api/v1/plan-categories');
    expect(collect($visible->json('data'))->pluck('slug'))->not->toContain('recovery');

    $all = $this->actingAs(planAdmin(), 'sanctum')->getJson('/api/v1/plan-categories?include_inactive=1');
    expect(collect($all->json('data'))->pluck('slug'))->toContain('recovery');
});

test('a name too long to slug into the plans column is rejected', function (): void {
    $this->actingAs(planAdmin(), 'sanctum')
        ->postJson('/api/v1/plan-categories', [
            'name' => str_repeat('extremely long category name ', 3),
        ])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed');
});

test('plan scope is derived from the plan types when not supplied', function (): void {
    $this->actingAs(planAdmin(), 'sanctum')
        ->postJson('/api/v1/plan-categories', [
            'name' => 'Cardio Zone',
            'plan_type' => 'membership',
        ])
        ->assertCreated()
        ->assertJsonPath('data.plan_scope', 'gym_access');

    $this->actingAs(planAdmin(), 'sanctum')
        ->postJson('/api/v1/plan-categories', [
            'name' => 'Massage',
            'plan_type' => 'extra_service',
        ])
        ->assertCreated()
        ->assertJsonPath('data.plan_scope', 'extra_service');
});

test('an explicit plan scope wins over the derived one', function (): void {
    $this->actingAs(planAdmin(), 'sanctum')
        ->postJson('/api/v1/plan-categories', [
            'name' => 'Studio Pass',
            'plan_type' => 'membership',
            'plan_scope' => 'fitness_studio',
        ])
        ->assertCreated()
        ->assertJsonPath('data.plan_scope', 'fitness_studio');
});

// ─── Regressions found by driving the live API ──────────────────────────────

test('a duplicate category name is a field error, not a database crash', function (): void {
    $this->actingAs(planAdmin(), 'sanctum')
        ->postJson('/api/v1/plan-categories', ['name' => 'Yoga', 'plan_type' => 'extra_service'])
        ->assertCreated();

    // The slug is derived from the name, so nothing was validating it for
    // uniqueness — the unique index raised a 500 instead.
    $response = $this->actingAs(planAdmin(), 'sanctum')
        ->postJson('/api/v1/plan-categories', ['name' => 'Yoga', 'plan_type' => 'extra_service']);

    $response->assertStatus(422);
    expect($response->json('error.details.name.0'))->toContain('already exists');
});

test('a category name that differs only by case or spacing is still a duplicate', function (): void {
    $this->actingAs(planAdmin(), 'sanctum')
        ->postJson('/api/v1/plan-categories', ['name' => 'Yoga Flow', 'plan_type' => 'extra_service'])
        ->assertCreated();

    foreach (['yoga flow', 'YOGA FLOW', 'Yoga  Flow'] as $variant) {
        $this->actingAs(planAdmin(), 'sanctum')
            ->postJson('/api/v1/plan-categories', ['name' => $variant, 'plan_type' => 'extra_service'])
            ->assertStatus(422);
    }
});

test('a category name with no letters or digits is rejected', function (): void {
    // These slug to an empty string. The first one used to be created with a blank
    // slug and the second crashed on the unique index.
    foreach (['###', '---', '!!!', '   '] as $name) {
        $response = $this->actingAs(planAdmin(), 'sanctum')
            ->postJson('/api/v1/plan-categories', ['name' => $name, 'plan_type' => 'membership']);

        $response->assertStatus(422);
        expect(PlanCategory::query()->where('slug', '')->count())->toBe(0);
    }
});

test('clashing with a retired category points the admin at restoring it', function (): void {
    PlanCategory::query()->where('slug', 'recovery')->update(['is_active' => false]);

    $response = $this->actingAs(planAdmin(), 'sanctum')
        ->postJson('/api/v1/plan-categories', ['name' => 'Recovery', 'plan_type' => 'extra_service']);

    $response->assertStatus(422);
    expect($response->json('error.details.name.0'))->toContain('restore it instead');
});

test('a plan category is stored in its canonical form', function (): void {
    // MySQL matches case-insensitively and ignores trailing spaces, so these
    // resolve to gym_access — but the raw value used to be what got stored, and
    // business logic compares plans.category with a case-sensitive ===.
    foreach (['GYM_ACCESS', ' gym_access ', 'Gym_Access'] as $index => $variant) {
        $this->actingAs(planAdmin(), 'sanctum')
            ->postJson('/api/v1/plans', [
                'name' => "Canonical probe {$index}",
                'price' => 500,
                'duration_days' => 30,
                'is_unlimited_sessions' => true,
                'type' => 'membership',
                'category' => $variant,
            ])
            ->assertCreated()
            ->assertJsonPath('data.category', 'gym_access');
    }
});

test('the plans type column is wide enough for every plan type', function (): void {
    // `membership_extra_service` is 24 characters and the column was varchar(20),
    // so creating a plan of that type failed with a truncation error on MySQL.
    // SQLite neither enforces varchar length nor reports it after a column change,
    // so this can only be checked on a driver that does.
    $column = collect(Schema::getColumns('plans'))->firstWhere('name', 'type');

    if (! preg_match('/\((\d+)\)/', (string) $column['type'], $matches)) {
        $this->markTestSkipped(
            'driver ['.DB::connection()->getDriverName().'] does not report column lengths'
        );
    }

    expect((int) $matches[1])->toBeGreaterThanOrEqual(max(array_map('strlen', PlanCategory::PLAN_TYPES)));
});

test('a plan with an access window can be re-saved unchanged', function (): void {
    // MySQL TIME columns serialise as "06:00:00" but the request rules speak H:i,
    // so opening such a plan and pressing Save without touching it used to 422.
    $created = $this->actingAs(planAdmin(), 'sanctum')
        ->postJson('/api/v1/plans', [
            'name' => 'Morning window plan',
            'price' => 480,
            'duration_days' => 30,
            'is_unlimited_sessions' => true,
            'type' => 'membership',
            'category' => 'gym_access',
            'access_starts_at' => '06:00',
            'access_ends_at' => '12:00',
        ])->assertCreated();

    // The API must hand back the same format it accepts.
    $created->assertJsonPath('data.access_starts_at', '06:00')
        ->assertJsonPath('data.access_ends_at', '12:00');

    $plan = $created->json('data');

    $this->actingAs(planAdmin(), 'sanctum')
        ->putJson("/api/v1/plans/{$plan['id']}", [
            'name' => $plan['name'],
            'price' => $plan['price'],
            'duration_days' => $plan['duration_days'],
            'is_unlimited_sessions' => true,
            'type' => $plan['type'],
            'category' => $plan['category'],
            'access_starts_at' => $plan['access_starts_at'],
            'access_ends_at' => $plan['access_ends_at'],
        ])
        ->assertOk();
});

test('an access window sent with seconds is still accepted', function (): void {
    $this->actingAs(planAdmin(), 'sanctum')
        ->postJson('/api/v1/plans', [
            'name' => 'Seconds window plan',
            'price' => 480,
            'duration_days' => 30,
            'is_unlimited_sessions' => true,
            'type' => 'membership',
            'category' => 'gym_access',
            'access_starts_at' => '06:00:00',
            'access_ends_at' => '12:00:00',
        ])
        ->assertCreated()
        ->assertJsonPath('data.access_starts_at', '06:00');
});
