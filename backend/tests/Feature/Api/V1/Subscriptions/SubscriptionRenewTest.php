<?php

use App\Models\Member;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Notifications\OperationalNotification;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\MembershipAccessSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Notification;
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

/** A 300.00 / 30-day membership running 2026-06-01..06-30, so a renewal starts 2026-07-01. */
function renewableSubscription(array $planOverrides = []): Subscription
{
    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->active()->create(array_merge([
        'price' => '300.00',
        'duration_days' => 30,
    ], $planOverrides));

    return Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'start_date' => '2026-06-01',
        'end_date' => '2026-06-30',
        'price_paid' => '300.00',
    ]);
}

test('admin can renew a subscription and a new row is created', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->active()->create([
        'price' => '300.00',
        'duration_days' => 30,
    ]);

    $subscription = Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'start_date' => '2026-06-01',
        'end_date' => '2026-06-30',
        'price_paid' => '300.00',
    ]);

    $this->postJson("/api/v1/subscriptions/{$subscription->id}/renew", [
        'payment' => [
            'amount' => '300.00',
            'method' => 'cash',
        ],
    ])
        ->assertStatus(201)
        ->assertJsonPath('data.start_date', '2026-07-01')
        ->assertJsonPath('data.end_date', '2026-07-31');

    expect(Subscription::count())->toBe(2);
});

/*
|--------------------------------------------------------------------------
| Renewing on terms the plan does not describe
|--------------------------------------------------------------------------
|
| The desk can charge more, run the period longer and hand out more sessions
| than the catalogue says, for this member and this period only. Every one of
| those is optional; sending none of them renews exactly as the plan is sold.
*/

test('a renewal can be sold at a price the plan does not charge', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $subscription = renewableSubscription();

    // The plan is 300. This member pays 500 for the period, and the whole 500
    // is settled by the payment — no balance, and no days quietly added.
    $this->postJson("/api/v1/subscriptions/{$subscription->id}/renew", [
        'price' => '500.00',
        'payment' => ['amount' => '500.00', 'method' => 'cash'],
    ])
        ->assertStatus(201)
        ->assertJsonPath('data.price_paid', '500.00')
        ->assertJsonPath('data.end_date', '2026-07-31');

    $renewed = Subscription::query()->latest('id')->firstOrFail();

    expect($renewed->payments()->sum('amount'))->toEqual(500.00)
        ->and($renewed->plan->price)->toBe('300.00');
});

test('a renewal can run longer and carry more sessions than the plan', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $subscription = renewableSubscription(['sessions_count' => 12]);

    $this->postJson("/api/v1/subscriptions/{$subscription->id}/renew", [
        'end_date' => '2026-08-15',
        'sessions_total' => 20,
        'price' => '450.00',
        'payment' => ['amount' => '450.00', 'method' => 'cash'],
    ])
        ->assertStatus(201)
        ->assertJsonPath('data.start_date', '2026-07-01')
        ->assertJsonPath('data.end_date', '2026-08-15')
        ->assertJsonPath('data.sessions_total', 20)
        ->assertJsonPath('data.sessions_remaining', 20);
});

test('a renewal can be handed unlimited sessions', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $subscription = renewableSubscription(['sessions_count' => 12]);

    $this->postJson("/api/v1/subscriptions/{$subscription->id}/renew", [
        'unlimited_sessions' => true,
        'payment' => ['amount' => '300.00', 'method' => 'cash'],
    ])
        ->assertStatus(201)
        ->assertJsonPath('data.sessions_total', null)
        ->assertJsonPath('data.sessions_remaining', null);
});

test('a renewal ending before it starts is refused', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $subscription = renewableSubscription();

    // The new period starts the day after the current one ends: 2026-07-01.
    $this->postJson("/api/v1/subscriptions/{$subscription->id}/renew", [
        'end_date' => '2026-06-15',
        'payment' => ['amount' => '300.00', 'method' => 'cash'],
    ])
        ->assertStatus(422)
        ->assertJsonPath('error.details.end_date.0', 'The renewal cannot end before it starts on 2026-07-01.');

    expect(Subscription::count())->toBe(1);
});

test('renewing on custom terms tells the admins what was changed', function (): void {
    Notification::fake();

    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);

    $cashier = User::factory()->create(['name' => 'Reception Sara']);
    $cashier->assignRole(FoundationPermissions::ROLE_CASHIER);
    Sanctum::actingAs($cashier);

    $subscription = renewableSubscription(['sessions_count' => 12]);

    $this->postJson("/api/v1/subscriptions/{$subscription->id}/renew", [
        'price' => '500.00',
        'sessions_total' => 20,
        'payment' => ['amount' => '500.00', 'method' => 'cash'],
    ])->assertStatus(201);

    Notification::assertSentTo($admin, OperationalNotification::class, function ($notification) use ($admin) {
        $payload = $notification->toArray($admin);

        return $payload['category'] === 'membership.renewal_custom_terms'
            && str_contains($payload['body'], 'Reception Sara')
            && str_contains($payload['body'], 'price EGP 300.00 → 500.00')
            && str_contains($payload['body'], 'sessions 12 → 20');
    });
});

test('renewing exactly as the plan is sold raises no custom-terms alert', function (): void {
    Notification::fake();

    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $subscription = renewableSubscription();

    $this->postJson("/api/v1/subscriptions/{$subscription->id}/renew", [
        'payment' => ['amount' => '300.00', 'method' => 'cash'],
    ])->assertStatus(201);

    // The ordinary "new subscription" note still goes out; what must not is the
    // alert that says someone sold this membership on terms of their own.
    Notification::assertNotSentTo($user, OperationalNotification::class, function ($notification) use ($user) {
        return $notification->toArray($user)['category'] === 'membership.renewal_custom_terms';
    });
});

test('posting the plan defaults back is not treated as a custom sale', function (): void {
    // The renewal form is prefilled from the plan and posts every field, so the
    // plan's own price, dates and sessions come back to us on an ordinary sale.
    Notification::fake();

    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $subscription = renewableSubscription(['sessions_count' => 12]);

    $this->postJson("/api/v1/subscriptions/{$subscription->id}/renew", [
        'price' => '300.00',
        'end_date' => '2026-07-31',
        'sessions_total' => 12,
        'payment' => ['amount' => '300.00', 'method' => 'cash'],
    ])->assertStatus(201);

    Notification::assertNotSentTo($user, OperationalNotification::class, function ($notification) use ($user) {
        return $notification->toArray($user)['category'] === 'membership.renewal_custom_terms';
    });
});

test('paying above the renewal price does not move the end date on its own', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $subscription = renewableSubscription();

    // 500 handed over for a 300 period. The gym took 500; the period is still
    // the period, because nobody asked for the difference to buy days.
    $this->postJson("/api/v1/subscriptions/{$subscription->id}/renew", [
        'payment' => ['amount' => '500.00', 'method' => 'cash'],
    ])
        ->assertStatus(201)
        ->assertJsonPath('data.end_date', '2026-07-31');
});

test('paying above the renewal price buys days when the desk asks for it', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $subscription = renewableSubscription();

    // 300 over 2026-07-01..07-31 is a daily rate of 10.00, so the 100.00 excess
    // buys 10 days.
    $this->postJson("/api/v1/subscriptions/{$subscription->id}/renew", [
        'payment' => [
            'amount' => '400.00',
            'method' => 'cash',
            'extend_days_for_overpayment' => true,
        ],
    ])
        ->assertStatus(201)
        ->assertJsonPath('data.end_date', '2026-08-10');
});

test('admin cannot renew a subscription when the next active period already exists', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->active()->create([
        'price' => '300.00',
        'duration_days' => 30,
    ]);

    $subscription = Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'start_date' => '2026-06-01',
        'end_date' => '2026-06-30',
        'price_paid' => '300.00',
    ]);

    Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'start_date' => '2026-07-01',
        'end_date' => '2026-07-31',
        'price_paid' => '300.00',
    ]);

    $this->postJson("/api/v1/subscriptions/{$subscription->id}/renew", [
        'payment' => [
            'amount' => '300.00',
            'method' => 'cash',
        ],
    ])
        ->assertStatus(422)
        ->assertJsonPath('error.details.subscription.0', 'This subscription already has an active renewal for the next period.');

    expect(Subscription::count())->toBe(2);
});
