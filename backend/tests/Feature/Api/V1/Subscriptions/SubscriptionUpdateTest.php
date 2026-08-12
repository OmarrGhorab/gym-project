<?php

use App\Models\Member;
use App\Models\Payment;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\MembershipAccessSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(MembershipAccessSeeder::class);
});

function subscriptionForCorrection(array $overrides = []): Subscription
{
    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->active()->create(['price' => '2000.00', 'duration_days' => 30]);

    return Subscription::factory()->active()->create(array_merge([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'start_date' => '2026-08-10',
        'end_date' => '2026-09-09',
        'price_paid' => '2000.00',
    ], $overrides));
}

test('admin can correct the dates of a membership entered wrong', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $subscription = subscriptionForCorrection();

    $this->patchJson("/api/v1/subscriptions/{$subscription->id}", [
        'start_date' => '2026-08-15',
        'end_date' => '2026-09-14',
    ])
        ->assertStatus(200)
        ->assertJsonPath('data.start_date', '2026-08-15')
        ->assertJsonPath('data.end_date', '2026-09-14');
});

test('correcting the price moves the balance without touching what was collected', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $subscription = subscriptionForCorrection();

    Payment::factory()->partial()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $subscription->id,
        'amount' => '1000.00',
    ]);

    $this->patchJson("/api/v1/subscriptions/{$subscription->id}", ['price_paid' => '1800.00'])
        ->assertStatus(200)
        ->assertJsonPath('data.price_paid', '1800.00')
        ->assertJsonPath('data.paid_total', '1000.00')
        ->assertJsonPath('data.balance', '800.00');

    // The money that changed hands is a fact about a day that has closed —
    // a correction must not restate it.
    expect(Payment::query()->where('payable_id', $subscription->id)->count())->toBe(1);
    expect(Payment::query()->where('payable_id', $subscription->id)->value('amount'))->toBe('1000.00');
});

test('a correction that moves the start into the future makes the membership scheduled', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $subscription = subscriptionForCorrection();

    $this->patchJson("/api/v1/subscriptions/{$subscription->id}", [
        'start_date' => now()->addDays(5)->toDateString(),
        'end_date' => now()->addDays(35)->toDateString(),
    ])
        ->assertStatus(200)
        ->assertJsonPath('data.status', 'scheduled')
        ->assertJsonPath('data.starts_in_days', 5);

    // Nothing had to run for that — the column still says active.
    expect($subscription->fresh()->status)->toBe('active');
});

test('a correction rejects an end date before the start date', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $subscription = subscriptionForCorrection();

    $this->patchJson("/api/v1/subscriptions/{$subscription->id}", [
        'start_date' => '2026-09-01',
        'end_date' => '2026-08-01',
    ])->assertStatus(422);
});

test('correcting only the end date is still checked against the stored start date', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $subscription = subscriptionForCorrection(['start_date' => '2026-08-10']);

    $this->patchJson("/api/v1/subscriptions/{$subscription->id}", ['end_date' => '2026-08-01'])
        ->assertStatus(422)
        ->assertJsonPath('error.details.end_date.0', 'The end date must be on or after the start date.');
});

test('a correction rejects a negative price', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $subscription = subscriptionForCorrection();

    $this->patchJson("/api/v1/subscriptions/{$subscription->id}", ['price_paid' => '-1'])
        ->assertStatus(422)
        ->assertJsonStructure(['error' => ['details' => ['price_paid']]]);
});

test('a correction leaves untouched fields alone', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $subscription = subscriptionForCorrection();

    $this->patchJson("/api/v1/subscriptions/{$subscription->id}", ['price_paid' => '1500.00'])
        ->assertStatus(200)
        ->assertJsonPath('data.start_date', '2026-08-10')
        ->assertJsonPath('data.end_date', '2026-09-09');
});

test('a role without upgrade permission cannot correct a membership', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ACCOUNTANT);
    Sanctum::actingAs($user);

    $subscription = subscriptionForCorrection();

    $this->patchJson("/api/v1/subscriptions/{$subscription->id}", ['price_paid' => '1500.00'])
        ->assertStatus(403);
});

test('a cashier can correct a membership, because the till can already change plans', function (): void {
    // Corrections ride on subscriptions.upgrade, and the cashier role holds it.
    // If dates and prices should be tighter than plan changes, that is a
    // decision about the role, not about this endpoint.
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_CASHIER);
    Sanctum::actingAs($user);

    $subscription = subscriptionForCorrection();

    $this->patchJson("/api/v1/subscriptions/{$subscription->id}", ['price_paid' => '1500.00'])
        ->assertStatus(200);
});

test('correcting a membership requires authentication', function (): void {
    $subscription = subscriptionForCorrection();

    $this->patchJson("/api/v1/subscriptions/{$subscription->id}", ['price_paid' => '1500.00'])
        ->assertStatus(401);
});

test('correcting a membership that does not exist returns 404', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $this->patchJson('/api/v1/subscriptions/999999', ['price_paid' => '1500.00'])
        ->assertStatus(404);
});
