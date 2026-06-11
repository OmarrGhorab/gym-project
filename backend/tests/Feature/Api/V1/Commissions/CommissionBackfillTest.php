<?php

use App\Models\Commission;
use App\Models\Employee;
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
    $employee = Employee::factory()->captain()->create([
        'user_id' => $user->id,
        'commission_rate' => '0.1000',
    ]);

    // We must temporarily disable observers or delete any auto-created commission
    // so we can test the backfill on historical data.
    // For now, let's just create a subscription:
    $subscription = Subscription::factory()->create([
        'sold_by_user_id' => $user->id,
        'price_paid' => '100.00',
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
    $employee = Employee::factory()->captain()->create([
        'user_id' => $user->id,
        'commission_rate' => '0.1000',
    ]);

    Subscription::factory()->create([
        'sold_by_user_id' => $user->id,
        'price_paid' => '100.00',
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
