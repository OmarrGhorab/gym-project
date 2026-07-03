<?php

use App\Models\Member;
use App\Models\Plan;
use App\Models\Subscription;
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
    Carbon::setTestNow('2026-06-10');
});

afterEach(function (): void {
    Carbon::setTestNow();
});

test('admin can upgrade a subscription to a new plan with prorated credit', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->active()->create();

    $basicPlan = Plan::factory()->active()->create([
        'price' => '300.00',
        'duration_days' => 30,
        'category' => 'gym_access',
    ]);

    $vipPlan = Plan::factory()->active()->create([
        'price' => '600.00',
        'duration_days' => 30,
        'category' => 'gym_access',
    ]);

    $subscription = Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => $basicPlan->id,
        'start_date' => '2026-06-01',
        'end_date' => '2026-06-30',
        'price_paid' => '300.00',
    ]);

    // 9 of 30 days used -> 21 remaining -> 210.00 credit
    $this->postJson("/api/v1/subscriptions/{$subscription->id}/upgrade", [
        'plan_id' => $vipPlan->id,
        'payment' => [
            'amount' => '390.00',
            'method' => 'cash',
        ],
    ])
        ->assertStatus(201)
        ->assertJsonPath('data.status', 'active')
        ->assertJsonPath('data.plan.id', $vipPlan->id)
        ->assertJsonPath('data.price_paid', '390.00');

    $subscription->refresh();
    expect($subscription->status)->toBe('stopped')
        ->and(Subscription::count())->toBe(2);
});

test('upgrade stops the old subscription and tracks the link', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->active()->create();
    $basicPlan = Plan::factory()->active()->create(['price' => '300.00', 'duration_days' => 30]);
    $vipPlan = Plan::factory()->active()->create(['price' => '600.00', 'duration_days' => 30]);

    $subscription = Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => $basicPlan->id,
        'start_date' => '2026-06-01',
        'end_date' => '2026-06-30',
        'price_paid' => '300.00',
    ]);

    $response = $this->postJson("/api/v1/subscriptions/{$subscription->id}/upgrade", [
        'plan_id' => $vipPlan->id,
        'payment' => [
            'amount' => '500.00',
            'method' => 'cash',
        ],
    ])->assertStatus(201);

    $newId = $response->json('data.id');
    $newSubscription = Subscription::findOrFail($newId);

    expect($newSubscription->upgraded_from_subscription_id)->toBe($subscription->id);
});

test('upgrade with full credit coverage allows zero payment', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->active()->create();
    $basicPlan = Plan::factory()->active()->create(['price' => '1000.00', 'duration_days' => 30]);
    $vipPlan = Plan::factory()->active()->create(['price' => '600.00', 'duration_days' => 30]);

    $subscription = Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => $basicPlan->id,
        'start_date' => '2026-06-01',
        'end_date' => '2026-06-30',
        'price_paid' => '1000.00',
    ]);

    // 9 of 30 days used -> 21 remaining -> 700.00 credit, covers VIP price
    $this->postJson("/api/v1/subscriptions/{$subscription->id}/upgrade", [
        'plan_id' => $vipPlan->id,
        'payment' => [
            'amount' => '0.00',
            'method' => 'cash',
        ],
    ])
        ->assertStatus(201)
        ->assertJsonPath('data.price_paid', '0.00');
});

test('upgrade rejects same plan and suggests renew', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->active()->create(['price' => '300.00', 'duration_days' => 30]);

    $subscription = Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'start_date' => '2026-06-01',
        'end_date' => '2026-06-30',
        'price_paid' => '300.00',
    ]);

    $this->postJson("/api/v1/subscriptions/{$subscription->id}/upgrade", [
        'plan_id' => $plan->id,
        'payment' => [
            'amount' => '300.00',
            'method' => 'cash',
        ],
    ])
        ->assertStatus(422)
        ->assertJsonPath('error.details.plan_id.0', 'Use the renew endpoint to extend the same plan.');
});

test('upgrade rejects inactive subscription', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->active()->create();
    $basicPlan = Plan::factory()->active()->create(['price' => '300.00', 'duration_days' => 30]);
    $vipPlan = Plan::factory()->active()->create(['price' => '600.00', 'duration_days' => 30]);

    $subscription = Subscription::factory()->expired()->create([
        'member_id' => $member->id,
        'plan_id' => $basicPlan->id,
    ]);

    $this->postJson("/api/v1/subscriptions/{$subscription->id}/upgrade", [
        'plan_id' => $vipPlan->id,
        'payment' => [
            'amount' => '600.00',
            'method' => 'cash',
        ],
    ])
        ->assertStatus(422)
        ->assertJsonPath('error.details.subscription.0', 'Only active subscriptions can be upgraded.');
});

test('upgrade rejects unsellable plan', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->active()->create();
    $basicPlan = Plan::factory()->active()->create(['price' => '300.00', 'duration_days' => 30]);
    $vipPlan = Plan::factory()->inactive()->create(['price' => '600.00', 'duration_days' => 30]);

    $subscription = Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => $basicPlan->id,
        'start_date' => '2026-06-01',
        'end_date' => '2026-06-30',
        'price_paid' => '300.00',
    ]);

    $this->postJson("/api/v1/subscriptions/{$subscription->id}/upgrade", [
        'plan_id' => $vipPlan->id,
        'payment' => [
            'amount' => '600.00',
            'method' => 'cash',
        ],
    ])
        ->assertStatus(422)
        ->assertJsonPath('error.details.plan_id.0', 'The selected plan is not currently sellable.');
});

test('cashier without upgrade permission cannot upgrade', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_CAPTAIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->active()->create();
    $basicPlan = Plan::factory()->active()->create(['price' => '300.00', 'duration_days' => 30]);
    $vipPlan = Plan::factory()->active()->create(['price' => '600.00', 'duration_days' => 30]);

    $subscription = Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => $basicPlan->id,
    ]);

    $this->postJson("/api/v1/subscriptions/{$subscription->id}/upgrade", [
        'plan_id' => $vipPlan->id,
        'payment' => [
            'amount' => '600.00',
            'method' => 'cash',
        ],
    ])->assertStatus(403);
});
