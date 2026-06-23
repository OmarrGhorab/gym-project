<?php

use App\Models\Member;
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
        ->assertJsonPath('data.end_date', '2026-07-03');
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
    ]);

    $this->postJson("/api/v1/subscriptions/{$subscription->id}/unfreeze")
        ->assertStatus(200)
        ->assertJsonPath('data.status', 'active');
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
