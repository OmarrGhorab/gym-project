<?php

use App\Models\Member;
use App\Models\Payment;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Support\FoundationPermissions;
use App\Support\MembershipPermissions;
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

/*
 * Overpayment is not rejected, and it does not move the period on its own either.
 * Taking 1200 for a 1000 membership means the gym took 1200; whether the member also
 * bought more time is a separate decision, and the desk makes it by sending
 * extend_days_for_overpayment. Without that flag the excess simply stays recorded
 * against the subscription. With it, the excess is converted into days at the
 * subscription's daily rate inside the same locked transaction, and RecordPayment
 * throws a 422 when it cannot do so (no end_date/plan, or a zero-value subscription).
 */
test('payment store keeps an overpayment as money without moving the end date', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $subscription = makePayableSubscription();
    $originalEndDate = $subscription->end_date->copy();

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
        ->assertStatus(201)
        ->assertJsonPath('data.status', 'paid');

    expect($subscription->fresh()->end_date->toDateString())->toBe($originalEndDate->toDateString());
});

test('payment store converts an overpayment into extra days when asked', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $subscription = makePayableSubscription();
    $originalEndDate = $subscription->end_date->copy();

    Payment::factory()->partial()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $subscription->id,
        'amount' => '250.00',
    ]);

    // 250.00 already paid + 60.00 now = 310.00 against a 300.00 package.
    // The 10.00 excess buys 1 day at the 300.00 / 30-day daily rate of 10.00.
    $this->postJson('/api/v1/payments', [
        'subscription_id' => $subscription->id,
        'amount' => '60.00',
        'method' => 'cash',
        'extend_days_for_overpayment' => true,
    ])
        ->assertStatus(201)
        ->assertJsonPath('data.status', 'paid');

    expect($subscription->fresh()->end_date->toDateString())
        ->toBe($originalEndDate->addDay()->toDateString());
});

test('payment store rejects an overpayment it cannot convert into days', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    // A zero-value subscription has no daily rate, so the excess cannot be turned into
    // service and the request must be refused rather than silently doing nothing.
    $subscription = makePayableSubscription();
    $subscription->forceFill(['price_paid' => '0.00'])->save();

    $this->postJson('/api/v1/payments', [
        'subscription_id' => $subscription->id,
        'amount' => '60.00',
        'method' => 'cash',
        'extend_days_for_overpayment' => true,
    ])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed');

    expect(Payment::query()->where('payable_id', $subscription->id)->count())->toBe(0);
});

test('payment store returns 422 for missing subscription', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $this->postJson('/api/v1/payments', [
        'subscription_id' => 99999,
        'amount' => '60.00',
        'method' => 'cash',
    ])->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed');
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

test('user with payments create but without subscription view cannot record payment', function (): void {
    $user = User::factory()->create();
    $user->givePermissionTo(MembershipPermissions::PERM_PAYMENTS_CREATE);
    Sanctum::actingAs($user);

    $subscription = makePayableSubscription();

    $this->postJson('/api/v1/payments', [
        'subscription_id' => $subscription->id,
        'amount' => '60.00',
        'method' => 'cash',
    ])->assertStatus(403)
        ->assertJsonPath('error.code', 'forbidden');
});
