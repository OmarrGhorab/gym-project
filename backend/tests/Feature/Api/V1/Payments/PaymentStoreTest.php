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

function makePayableSubscription(): Subscription
{
    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->active()->create(['price' => '300.00']);

    return Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'price_paid' => '300.00',
    ]);
}

test('admin can record a partial payment', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $subscription = makePayableSubscription();

    $this->postJson('/api/v1/payments', [
        'subscription_id' => $subscription->id,
        'amount' => '100.00',
        'method' => 'cash',
    ])
        ->assertStatus(201)
        ->assertJsonPath('data.status', 'partial');
});

test('admin can record a payment that settles the balance', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $subscription = makePayableSubscription();

    $this->postJson('/api/v1/payments', [
        'subscription_id' => $subscription->id,
        'amount' => '300.00',
        'method' => 'cash',
    ])
        ->assertStatus(201)
        ->assertJsonPath('data.status', 'paid');
});

test('payment store rejects overpayment with 422', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $subscription = makePayableSubscription();
    Payment::factory()->partial()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $subscription->id,
        'amount' => '250.00',
    ]);

    $this->postJson('/api/v1/payments', [
        'subscription_id' => $subscription->id,
        'amount' => '60.00',
        'method' => 'cash',
    ])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed');
});

test('payment store returns 404 for missing subscription', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $this->postJson('/api/v1/payments', [
        'subscription_id' => 99999,
        'amount' => '60.00',
        'method' => 'cash',
    ])->assertStatus(422);
});

test('user without payments create permission receives 403', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_CAPTAIN);
    Sanctum::actingAs($user);

    $subscription = makePayableSubscription();

    $this->postJson('/api/v1/payments', [
        'subscription_id' => $subscription->id,
        'amount' => '60.00',
        'method' => 'cash',
    ])->assertStatus(403)
        ->assertJsonPath('error.code', 'forbidden');
});
