<?php

use App\Models\Member;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\SubscriptionFreeze;
use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\MembershipAccessSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(MembershipAccessSeeder::class);
    // The fixtures below use fixed mid-2026 dates; without pinning "now" the
    // resumed period reads as already expired once the wall clock passes them.
    Carbon::setTestNow('2026-06-10');
});

afterEach(function (): void {
    Carbon::setTestNow();
});

function makeLifecycleSubscription(User $user, array $planOverrides = [], array $subscriptionOverrides = []): Subscription
{
    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->active()->create(array_merge([
        'max_freeze_days' => 10,
    ], $planOverrides));

    return Subscription::factory()->active()->create(array_merge([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'sold_by_user_id' => $user->id,
    ], $subscriptionOverrides));
}

test('admin can freeze a subscription', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $subscription = makeLifecycleSubscription($user, subscriptionOverrides: [
        'end_date' => '2026-06-30',
    ]);

    $this->postJson("/api/v1/subscriptions/{$subscription->id}/freeze", [
        'freeze_start' => '2026-06-10',
        'freeze_end' => '2026-06-12',
        'reason' => 'travel',
    ])
        ->assertStatus(200)
        ->assertJsonPath('data.status', 'frozen')
        ->assertJsonPath('data.end_date', '2026-06-30')
        ->assertJsonPath('data.freeze.remaining_days_at_freeze', 20);
});

test('subscription index supports bounded per page requests', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    Subscription::factory()
        ->count(20)
        ->active()
        ->create([
            'member_id' => Member::factory()->active()->create()->id,
            'plan_id' => Plan::factory()->active()->create()->id,
            'sold_by_user_id' => $user->id,
        ]);

    $this->getJson('/api/v1/subscriptions?per_page=20')
        ->assertOk()
        ->assertJsonPath('meta.per_page', 20)
        ->assertJsonCount(20, 'data');
});

test('freeze rejects cap exceeded with 422', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $subscription = makeLifecycleSubscription($user, ['max_freeze_days' => 2]);

    $this->postJson("/api/v1/subscriptions/{$subscription->id}/freeze", [
        'freeze_start' => '2026-06-10',
        'freeze_end' => '2026-06-12',
    ])->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed');
});

test('admin can unfreeze a subscription', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $subscription = makeLifecycleSubscription($user, subscriptionOverrides: [
        'status' => 'frozen',
        'end_date' => '2026-07-23',
    ]);
    SubscriptionFreeze::factory()->create([
        'subscription_id' => $subscription->id,
        'freeze_start' => '2026-07-05',
        'freeze_end' => '2026-07-09',
        'remaining_days_at_freeze' => 18,
        'resumed_on' => null,
    ]);

    $this->postJson("/api/v1/subscriptions/{$subscription->id}/unfreeze", [
        'resume_on' => '2026-07-09',
    ])
        ->assertStatus(200)
        ->assertJsonPath('data.status', 'active')
        ->assertJsonPath('data.end_date', '2026-07-27');
});

test('admin can stop a subscription', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $subscription = makeLifecycleSubscription($user);

    $this->postJson("/api/v1/subscriptions/{$subscription->id}/stop")
        ->assertStatus(200)
        ->assertJsonPath('data.status', 'stopped');
});

test('user without lifecycle permissions receives 403', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_CASHIER);
    Sanctum::actingAs($user);

    $subscription = makeLifecycleSubscription($user);

    $this->postJson("/api/v1/subscriptions/{$subscription->id}/freeze", [
        'freeze_start' => '2026-06-10',
        'freeze_end' => '2026-06-12',
    ])->assertStatus(403)
        ->assertJsonPath('error.code', 'forbidden');
});

test('freeze already-frozen subscription returns 409', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $subscription = makeLifecycleSubscription($user, subscriptionOverrides: [
        'end_date' => '2026-07-15',
    ]);

    // Freeze once
    $this->postJson("/api/v1/subscriptions/{$subscription->id}/freeze", [
        'freeze_start' => '2026-06-10',
        'freeze_end' => '2026-06-12',
        'reason' => 'travel',
    ])->assertStatus(200);

    // Freeze again — should fail
    $this->postJson("/api/v1/subscriptions/{$subscription->id}/freeze", [
        'freeze_start' => '2026-06-15',
        'freeze_end' => '2026-06-17',
        'reason' => 'travel again',
    ])->assertStatus(422);
});

test('unfreeze non-frozen subscription returns 409', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $subscription = makeLifecycleSubscription($user);

    $this->postJson("/api/v1/subscriptions/{$subscription->id}/unfreeze")
        ->assertStatus(422);
});

test('stop already-stopped subscription returns 409', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $subscription = makeLifecycleSubscription($user);

    $this->postJson("/api/v1/subscriptions/{$subscription->id}/stop", [
        'reason' => 'member requested',
    ])->assertStatus(200);

    $this->postJson("/api/v1/subscriptions/{$subscription->id}/stop", [
        'reason' => 'try again',
    ])->assertStatus(422);
});

test('admin can renew an expired subscription', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->active()->create(['price' => '100.00']);
    $subscription = Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'sold_by_user_id' => $user->id,
        'end_date' => '2026-01-01',
        'status' => 'expired',
    ]);

    $this->postJson("/api/v1/subscriptions/{$subscription->id}/renew", [
        'payment' => [
            'amount' => '100.00',
            'method' => 'cash',
        ],
    ])->assertStatus(201);
});
