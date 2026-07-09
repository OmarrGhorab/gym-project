<?php

use App\Models\Commission;
use App\Models\Employee;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\HrFinanceAccessSeeder;
use Laravel\Sanctum\Sanctum;

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(HrFinanceAccessSeeder::class);
});

test('admin can run backfill and it creates commissions idempotently', function (): void {
    $adminUser = User::factory()->create();
    $adminUser->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($adminUser);

    $user = User::factory()->create();
    Employee::factory()->captain()->create([
        'user_id' => $user->id,
    ]);

    // We must temporarily disable observers or delete any auto-created commission
    // so we can test the backfill on historical data.
    // For now, let's just create a subscription:
    $subscription = Subscription::factory()->create([
        'sold_by_user_id' => $user->id,
        'price_paid' => '100.00',
        'plan_id' => Plan::factory()->create(['commission_rate' => '0.1000'])->id,
    ]);

    // Delete the auto-created commission (simulate historical data that lacks one)
    Commission::query()->delete();

    // Call backfill
    $this->postJson('/api/v1/commissions/backfill')
        ->assertStatus(200)
        ->assertJsonPath('data.created', 1);

    expect(Commission::count())->toBe(1);

    // Call backfill again (should be idempotent)
    $this->postJson('/api/v1/commissions/backfill')
        ->assertStatus(200)
        ->assertJsonPath('data.created', 0);

    expect(Commission::count())->toBe(1);
});

test('backfill dry_run returns scanned info without persisting commissions', function (): void {
    $adminUser = User::factory()->create();
    $adminUser->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($adminUser);

    $user = User::factory()->create();
    Employee::factory()->captain()->create([
        'user_id' => $user->id,
    ]);

    Subscription::factory()->create([
        'sold_by_user_id' => $user->id,
        'price_paid' => '100.00',
        'plan_id' => Plan::factory()->create(['commission_rate' => '0.1000'])->id,
    ]);

    Commission::query()->delete();

    $this->postJson('/api/v1/commissions/backfill', [
        'dry_run' => true,
    ])
        ->assertStatus(200)
        ->assertJsonPath('data.created', 0)
        ->assertJsonPath('data.scanned', 1);

    expect(Commission::count())->toBe(0);
});

test('backfill rejects malformed range parameters with 422', function (): void {
    $adminUser = User::factory()->create();
    $adminUser->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($adminUser);

    $this->postJson('/api/v1/commissions/backfill', [
        'from' => 'not-a-date',
        'to' => ['nested'],
    ])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed')
        ->assertJsonStructure(['error' => ['details' => ['from', 'to']]]);
});

test('backfill rejects a to date earlier than from with 422', function (): void {
    $adminUser = User::factory()->create();
    $adminUser->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($adminUser);

    $this->postJson('/api/v1/commissions/backfill', [
        'from' => '2026-06-30',
        'to' => '2026-06-01',
    ])
        ->assertStatus(422)
        ->assertJsonStructure(['error' => ['details' => ['to']]]);
});

test('accountant cannot trigger backfill and receives 403', function (): void {
    $accountant = User::factory()->create();
    $accountant->assignRole(FoundationPermissions::ROLE_ACCOUNTANT);
    Sanctum::actingAs($accountant);

    $this->postJson('/api/v1/commissions/backfill')
        ->assertStatus(403);
});

test('unauthenticated request to backfill receives 401', function (): void {
    $this->postJson('/api/v1/commissions/backfill')
        ->assertStatus(401);
});
