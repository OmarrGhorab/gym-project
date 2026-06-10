<?php

use App\Models\Plan;
use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\MembershipAccessSeeder;
use Illuminate\Testing\Fluent\AssertableJson;
use Laravel\Sanctum\Sanctum;

/**
 * US2 — Manage Plans & Offers: Plan Update + Toggle
 *
 * Covers:
 *  - PUT /plans/{id} → 200 updated
 *  - PUT /plans/{id} → 422 validation failures
 *  - PUT /plans/{id} → 401 unauthenticated
 *  - PUT /plans/{id} → 403 missing permission
 *  - PUT /plans/{id} → 404 not found
 *  - PATCH /plans/{id}/toggle → 200 is_active flipped
 *  - PATCH /plans/{id}/toggle → 401 unauthenticated
 *  - PATCH /plans/{id}/toggle → 403 missing permission
 *  - PATCH /plans/{id}/toggle → 404 not found
 */
beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(MembershipAccessSeeder::class);
});

// ─── PUT /plans/{id} ─────────────────────────────────────────────────────────

test('admin can update a plan and receives 200 with updated resource', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $plan = Plan::factory()->create(['name' => 'Old Name', 'price' => '200.00']);

    $this->putJson("/api/v1/plans/{$plan->id}", [
        'name' => 'New Name',
        'price' => '350.00',
        'duration_days' => 30,
        'type' => 'membership',
    ])
        ->assertStatus(200)
        ->assertJson(fn (AssertableJson $json) => $json
            ->has('data')
            ->has('meta')
            ->has('message')
            ->where('data.name', 'New Name')
            ->where('data.price', '350.00')
        );

    $this->assertDatabaseHas('plans', ['id' => $plan->id, 'name' => 'New Name']);
});

test('plan update returns 404 for non-existent plan', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $this->putJson('/api/v1/plans/99999', [
        'name' => 'New Name',
        'price' => '350.00',
        'duration_days' => 30,
        'type' => 'membership',
    ])->assertStatus(404);
});

test('unauthenticated plan update returns 401', function (): void {
    $plan = Plan::factory()->create();

    $this->putJson("/api/v1/plans/{$plan->id}", [
        'name' => 'New Name',
        'price' => '350.00',
        'duration_days' => 30,
        'type' => 'membership',
    ])->assertStatus(401);
});

test('cashier without plans.update permission gets 403 on update', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_CASHIER);
    Sanctum::actingAs($user);

    $plan = Plan::factory()->create();

    $this->putJson("/api/v1/plans/{$plan->id}", [
        'name' => 'New Name',
        'price' => '350.00',
        'duration_days' => 30,
        'type' => 'membership',
    ])->assertStatus(403);
});

test('plan update returns 422 when valid_to is before valid_from', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $plan = Plan::factory()->create();

    $this->putJson("/api/v1/plans/{$plan->id}", [
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

test('plan update returns 422 when max_freeze_days exceeds duration_days', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $plan = Plan::factory()->create();

    $this->putJson("/api/v1/plans/{$plan->id}", [
        'name' => 'Monthly',
        'price' => '300.00',
        'duration_days' => 10,
        'type' => 'membership',
        'max_freeze_days' => 15,
    ])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed')
        ->assertJsonStructure(['error' => ['details' => ['max_freeze_days']]]);
});

test('plan update returns 422 when price is negative', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $plan = Plan::factory()->create();

    $this->putJson("/api/v1/plans/{$plan->id}", [
        'name' => 'Monthly',
        'price' => '-5.00',
        'duration_days' => 30,
        'type' => 'membership',
    ])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed');
});

// ─── PATCH /plans/{id}/toggle ─────────────────────────────────────────────────

test('admin can toggle plan active state from true to false', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $plan = Plan::factory()->create(['is_active' => true]);

    $this->patchJson("/api/v1/plans/{$plan->id}/toggle")
        ->assertStatus(200)
        ->assertJson(fn (AssertableJson $json) => $json
            ->has('data')
            ->has('meta')
            ->has('message')
            ->where('data.is_active', false)
        );

    $this->assertDatabaseHas('plans', ['id' => $plan->id, 'is_active' => false]);
});

test('admin can toggle plan active state from false to true', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $plan = Plan::factory()->create(['is_active' => false]);

    $this->patchJson("/api/v1/plans/{$plan->id}/toggle")
        ->assertStatus(200)
        ->assertJsonPath('data.is_active', true);

    $this->assertDatabaseHas('plans', ['id' => $plan->id, 'is_active' => true]);
});

test('toggle returns 404 for non-existent plan', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $this->patchJson('/api/v1/plans/99999/toggle')
        ->assertStatus(404);
});

test('unauthenticated toggle returns 401', function (): void {
    $plan = Plan::factory()->create();

    $this->patchJson("/api/v1/plans/{$plan->id}/toggle")
        ->assertStatus(401);
});

test('cashier without plans.update permission gets 403 on toggle', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_CASHIER);
    Sanctum::actingAs($user);

    $plan = Plan::factory()->create();

    $this->patchJson("/api/v1/plans/{$plan->id}/toggle")
        ->assertStatus(403);
});

test('manager with plans.update permission can toggle plan', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_MANAGER);
    Sanctum::actingAs($user);

    $plan = Plan::factory()->create(['is_active' => true]);

    $this->patchJson("/api/v1/plans/{$plan->id}/toggle")
        ->assertStatus(200)
        ->assertJsonPath('data.is_active', false);
});
