<?php

use App\Models\Member;
use App\Models\Payment;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\SubscriptionAddon;
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

test('dues list returns subscriptions with outstanding balances only', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->active()->create();

    $dueSubscription = Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'price_paid' => '300.00',
    ]);

    $paidSubscription = Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'price_paid' => '300.00',
    ]);

    Payment::factory()->partial()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $dueSubscription->id,
        'amount' => '100.00',
    ]);

    Payment::factory()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $paidSubscription->id,
        'amount' => '300.00',
        'status' => 'paid',
    ]);

    $response = $this->getJson('/api/v1/payments/dues')
        ->assertStatus(200);

    $ids = collect($response->json('data'))->pluck('subscription.id')->all();

    expect($ids)->toContain($dueSubscription->id)
        ->not->toContain($paidSubscription->id);
});

test('dues list includes unpaid add-on service balances in the package total', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->active()->create();
    $basePlan = Plan::factory()->active()->create(['price' => '480.00']);
    $servicePlan = Plan::factory()->active()->create(['price' => '600.00', 'category' => 'nutrition']);
    $subscription = Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => $basePlan->id,
        'price_paid' => '480.00',
    ]);
    $addon = SubscriptionAddon::create([
        'subscription_id' => $subscription->id,
        'member_id' => $member->id,
        'plan_id' => $servicePlan->id,
        'start_date' => $subscription->start_date,
        'end_date' => $subscription->end_date,
        'status' => 'active',
        'price_paid' => '600.00',
    ]);

    Payment::factory()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $subscription->id,
        'amount' => '480.00',
        'status' => 'paid',
    ]);
    Payment::factory()->partial()->create([
        'payable_type' => SubscriptionAddon::class,
        'payable_id' => $addon->id,
        'amount' => '200.00',
    ]);

    $this->getJson('/api/v1/payments/dues')
        ->assertOk()
        ->assertJsonPath('data.0.subscription.id', $subscription->id)
        ->assertJsonPath('data.0.price_paid', '1080.00')
        ->assertJsonPath('data.0.paid_total', '680.00')
        ->assertJsonPath('data.0.balance', '400.00');
});

test('payment index filters by payment status when status is not due', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->active()->create();
    $subscription = Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
    ]);

    $paid = Payment::factory()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $subscription->id,
        'status' => 'paid',
    ]);

    Payment::factory()->partial()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $subscription->id,
        'status' => 'partial',
    ]);

    $response = $this->getJson('/api/v1/payments?status=paid')
        ->assertStatus(200)
        ->assertJsonPath('meta.total', 1);

    expect(collect($response->json('data'))->pluck('id')->all())->toBe([$paid->id]);
});

test('payment index rejects invalid status filter', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $this->getJson('/api/v1/payments?status=unknown')
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed');
});
