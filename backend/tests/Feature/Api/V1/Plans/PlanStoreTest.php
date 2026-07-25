<?php

use App\Models\Plan;
use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\MembershipAccessSeeder;
use Illuminate\Testing\Fluent\AssertableJson;
use Laravel\Sanctum\Sanctum;

/**
 * US2 — Manage Plans & Offers: Plan Index + Store
 *
 * Covers:
 *  - GET /plans → 200 paginated list (plans.view)
 *  - GET /plans → 401 unauthenticated
 *  - GET /plans → 403 missing permission
 *  - GET /plans → filter by type / is_active
 *  - POST /plans → 201 created (plans.create)
 *  - POST /plans → 422 validation failures
 *  - POST /plans → 401 unauthenticated
 *  - POST /plans → 403 missing permission
 */
beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(MembershipAccessSeeder::class);
});

// ─── GET /plans ─────────────────────────────────────────────────────────────

test('admin can list plans with 200 paginated envelope', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    Plan::factory()->count(3)->create();

    $this->getJson('/api/v1/plans')
        ->assertStatus(200)
        ->assertJson(fn (AssertableJson $json) => $json
            ->has('data')
            ->has('meta')
            ->has('message')
            ->has('meta.current_page')
            ->has('meta.per_page')
            ->has('meta.total')
            ->has('meta.last_page')
            ->etc()
        );
});

test('plan index honors requested per page size', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    Plan::factory()->count(20)->create();

    $this->getJson('/api/v1/plans?per_page=20')
        ->assertStatus(200)
        ->assertJsonCount(20, 'data');
});

test('unauthenticated request to plan index returns 401', function (): void {
    $this->getJson('/api/v1/plans')
        ->assertStatus(401)
        ->assertJsonPath('error.code', 'unauthenticated');
});

test('user without plans.view permission gets 403 on plan index', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_CAPTAIN);
    Sanctum::actingAs($user);

    $this->getJson('/api/v1/plans')
        ->assertStatus(403)
        ->assertJsonPath('error.code', 'forbidden');
});

test('plan index can be filtered by type', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    Plan::factory()->create(['type' => 'membership', 'name' => 'MemberPlan']);
    Plan::factory()->create(['type' => 'offer', 'name' => 'OfferPlan']);

    $response = $this->getJson('/api/v1/plans?filter[type]=membership')
        ->assertStatus(200);

    $data = $response->json('data');
    expect(collect($data)->every(fn ($p) => $p['type'] === 'membership'))->toBeTrue();
});

test('plan index can be filtered by is_active', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    Plan::factory()->create(['is_active' => true]);
    Plan::factory()->create(['is_active' => false]);

    $response = $this->getJson('/api/v1/plans?filter[is_active]=true')
        ->assertStatus(200);

    $data = $response->json('data');
    expect(collect($data)->every(fn ($p) => $p['is_active'] === true))->toBeTrue();
});

// ─── POST /plans ─────────────────────────────────────────────────────────────

test('admin can create a plan and receives 201 with plan resource', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $this->postJson('/api/v1/plans', [
        'name' => 'Monthly Membership',
        'description' => 'One month access',
        'price' => '300.00',
        'duration_days' => 30,
        'duration_months' => 1,
        'sessions_count' => null,
        'type' => 'membership',
        'category' => 'gym_access',
        'is_active' => true,
        'valid_from' => '2026-06-01',
        'valid_to' => '2026-12-31',
        'max_freeze_days' => 7,
        'access_grace_days' => 3,
    ])
        ->assertStatus(201)
        ->assertJson(fn (AssertableJson $json) => $json
            ->has('data')
            ->has('data.id')
            ->has('data.name')
            ->has('data.price')
            ->has('data.duration_days')
            ->has('data.duration_months')
            ->has('data.type')
            ->has('data.is_active')
            ->has('meta')
            ->has('message')
            ->where('data.name', 'Monthly Membership')
            ->where('data.type', 'membership')
            ->where('data.duration_months', 1)
            ->where('data.access_grace_days', 3)
        );

    $this->assertDatabaseHas('plans', ['name' => 'Monthly Membership']);
});

test('admin can create membership with an extra service plan type', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $this->postJson('/api/v1/plans', [
        'name' => 'Membership with Personal Training',
        'price' => '750.00',
        'duration_days' => 30,
        'sessions_count' => 8,
        'type' => 'membership_extra_service',
        'category' => 'personal_training',
    ])
        ->assertCreated()
        ->assertJsonPath('data.type', 'membership_extra_service');
});

test('cashier without plans.create permission gets 403 on plan store', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_CASHIER);
    Sanctum::actingAs($user);

    $this->postJson('/api/v1/plans', [
        'name' => 'Monthly',
        'price' => '300.00',
        'duration_days' => 30,
        'type' => 'membership',
    ])->assertStatus(403);
});

test('unauthenticated plan store returns 401', function (): void {
    $this->postJson('/api/v1/plans', [
        'name' => 'Monthly',
        'price' => '300.00',
        'duration_days' => 30,
        'type' => 'membership',
    ])->assertStatus(401);
});

test('plan store returns 422 when name is missing', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $this->postJson('/api/v1/plans', [
        'price' => '300.00',
        'duration_days' => 30,
        'type' => 'membership',
    ])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed')
        ->assertJsonStructure(['error' => ['details' => ['name']]]);
});

test('plan store returns 422 when price is negative', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $this->postJson('/api/v1/plans', [
        'name' => 'Monthly',
        'price' => '-1.00',
        'duration_days' => 30,
        'type' => 'membership',
    ])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed')
        ->assertJsonStructure(['error' => ['details' => ['price']]]);
});

test('plan store returns 422 when duration_days is less than 1', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $this->postJson('/api/v1/plans', [
        'name' => 'Monthly',
        'price' => '300.00',
        'duration_days' => 0,
        'type' => 'membership',
    ])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed')
        ->assertJsonStructure(['error' => ['details' => ['duration_days']]]);
});

test('plan store returns 422 when valid_to is before valid_from', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $this->postJson('/api/v1/plans', [
        'name' => 'Monthly',
        'price' => '300.00',
        'duration_days' => 30,
        'type' => 'membership',
        'valid_from' => '2026-12-31',
        'valid_to' => '2026-06-01',
    ])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed')
        ->assertJsonStructure(['error' => ['details' => ['valid_to']]]);
});

test('plan store returns 422 when max_freeze_days exceeds duration_days', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $this->postJson('/api/v1/plans', [
        'name' => 'Monthly',
        'price' => '300.00',
        'duration_days' => 30,
        'type' => 'membership',
        'max_freeze_days' => 31,
    ])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed')
        ->assertJsonStructure(['error' => ['details' => ['max_freeze_days']]]);
});

test('plan store returns 422 when type is invalid', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $this->postJson('/api/v1/plans', [
        'name' => 'Monthly',
        'price' => '300.00',
        'duration_days' => 30,
        'type' => 'invalid_type',
    ])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed')
        ->assertJsonStructure(['error' => ['details' => ['type']]]);
});

test('plan store accepts zero price (free plan)', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $this->postJson('/api/v1/plans', [
        'name' => 'Free Trial',
        'price' => '0.00',
        'duration_days' => 7,
        'type' => 'offer',
        'category' => 'gym_access',
        'valid_from' => '2026-07-01',
        'valid_to' => '2026-07-07',
    ])->assertStatus(201);
});

test('isSellable returns false for inactive plan', function (): void {
    $plan = Plan::factory()->create(['is_active' => false]);

    expect($plan->isSellable())->toBeFalse();
});

test('isSellable returns false for plan with valid_to in the past', function (): void {
    $plan = Plan::factory()->create([
        'is_active' => true,
        'valid_from' => '2025-01-01',
        'valid_to' => '2025-12-31',
    ]);

    expect($plan->isSellable())->toBeFalse();
});

test('isSellable returns false for plan with valid_from in the future', function (): void {
    $plan = Plan::factory()->create([
        'is_active' => true,
        'valid_from' => '2030-01-01',
        'valid_to' => null,
    ]);

    expect($plan->isSellable())->toBeFalse();
});

test('isSellable returns true for active plan with no window constraints', function (): void {
    $plan = Plan::factory()->create([
        'is_active' => true,
        'valid_from' => null,
        'valid_to' => null,
    ]);

    expect($plan->isSellable())->toBeTrue();
});

test('isSellable returns true for active plan within validity window', function (): void {
    $plan = Plan::factory()->create([
        'is_active' => true,
        'valid_from' => '2026-01-01',
        'valid_to' => '2026-12-31',
    ]);

    expect($plan->isSellable())->toBeTrue();
});
