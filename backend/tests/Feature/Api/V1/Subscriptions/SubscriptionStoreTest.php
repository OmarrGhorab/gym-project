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
use Illuminate\Testing\Fluent\AssertableJson;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(MembershipAccessSeeder::class);
});

test('admin can create a subscription and receives 201', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->active()->create([
        'price' => '300.00',
        'duration_days' => 30,
    ]);

    $this->postJson('/api/v1/subscriptions', [
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'start_date' => '2026-06-10',
        'end_date' => '2026-07-10',
        'discount' => '50.00',
        'payment' => [
            'amount' => '250.00',
            'method' => 'cash',
        ],
    ])
        ->assertStatus(201)
        ->assertJson(fn (AssertableJson $json) => $json
            ->where('data.member.id', $member->id)
            ->where('data.plan.id', $plan->id)
            ->where('data.status', 'active')
            ->where('data.start_date', '2026-06-10')
            ->where('data.end_date', '2026-07-10')
            ->where('data.sold_by.id', $user->id)
            ->has('message')
            ->has('meta')
        );

    expect(Subscription::count())->toBe(1);
});

test('admin can list subscriptions', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->active()->create();

    Subscription::factory()->count(2)->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
    ]);

    $this->getJson('/api/v1/subscriptions')
        ->assertStatus(200)
        ->assertJson(fn (AssertableJson $json) => $json
            ->has('data.0.id')
            ->has('meta.current_page')
            ->has('message')
        );
});

test('subscription list includes payment balance and renewal health fields', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->active()->create();
    $subscription = Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'price_paid' => '450.00',
        'end_date' => now()->addDays(5)->toDateString(),
    ]);

    Payment::factory()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $subscription->id,
        'amount' => '150.00',
        'status' => 'partial',
    ]);

    $this->getJson('/api/v1/subscriptions')
        ->assertStatus(200)
        ->assertJsonPath('data.0.paid_total', '150.00')
        ->assertJsonPath('data.0.balance', '300.00')
        ->assertJsonPath('data.0.billing_status', 'paid')
        ->assertJsonPath('data.0.days_left', 5)
        ->assertJsonPath('data.0.renewal_health', 'needs_action')
        ->assertJsonPath('data.0.renewal_health_reason', 'has_balance');
});

test('subscription list marks active subscriptions past end date as expired', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->active()->create();

    $subscription = Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'end_date' => now()->subDay()->toDateString(),
        'price_paid' => '450.00',
    ]);

    Payment::factory()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $subscription->id,
        'amount' => '450.00',
        'status' => 'paid',
    ]);

    $this->getJson('/api/v1/subscriptions')
        ->assertStatus(200)
        ->assertJsonPath('data.0.status', 'expired')
        ->assertJsonPath('data.0.renewal_health', 'needs_action')
        ->assertJsonPath('data.0.renewal_health_reason', 'expired');
});

test('subscription list keeps active status during plan access grace days', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->active()->create([
        'access_grace_days' => 3,
    ]);

    $subscription = Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'end_date' => now()->subDay()->toDateString(),
        'price_paid' => '450.00',
    ]);

    Payment::factory()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $subscription->id,
        'amount' => '450.00',
        'status' => 'paid',
    ]);

    $this->getJson('/api/v1/subscriptions')
        ->assertStatus(200)
        ->assertJsonPath('data.0.status', 'active')
        ->assertJsonPath('data.0.renewal_health', 'renew_soon')
        ->assertJsonPath('data.0.renewal_health_reason', 'ends_in');
});

test('admin can view subscription summary', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->active()->create();

    Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'end_date' => now()->addDays(3)->toDateString(),
        'price_paid' => '100.00',
    ]);
    Subscription::factory()->expired()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'price_paid' => '200.00',
    ]);
    Subscription::factory()->stopped()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'price_paid' => '50.00',
    ]);

    $this->getJson('/api/v1/subscriptions/summary')
        ->assertStatus(200)
        ->assertJsonPath('data.total', 3)
        ->assertJsonPath('data.active', 1)
        ->assertJsonPath('data.expired', 1)
        ->assertJsonPath('data.stopped', 1)
        ->assertJsonPath('data.expiring_soon', 1)
        ->assertJsonPath('data.revenue', '350.00');
});

test('subscription summary can filter by status', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    Subscription::factory()->active()->create(['price_paid' => '100.00']);
    Subscription::factory()->expired()->create(['price_paid' => '200.00']);

    $this->getJson('/api/v1/subscriptions/summary?filter[status]=expired')
        ->assertStatus(200)
        ->assertJsonPath('data.total', 1)
        ->assertJsonPath('data.active', 0)
        ->assertJsonPath('data.expired', 1)
        ->assertJsonPath('data.revenue', '200.00');
});

test('admin can show a subscription', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->active()->create();
    $subscription = Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'sold_by_user_id' => $user->id,
    ]);

    $this->getJson("/api/v1/subscriptions/{$subscription->id}")
        ->assertStatus(200)
        ->assertJsonPath('data.id', $subscription->id);
});

test('subscription create rejects inactive member with 422', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->inactive()->create();
    $plan = Plan::factory()->active()->create();

    $this->postJson('/api/v1/subscriptions', [
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'start_date' => '2026-06-10',
        'payment' => [
            'amount' => '100.00',
            'method' => 'cash',
        ],
    ])->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed');
});

test('subscription create rejects unsellable plan with 422', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->inactive()->create();

    $this->postJson('/api/v1/subscriptions', [
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'start_date' => '2026-06-10',
        'payment' => [
            'amount' => '100.00',
            'method' => 'cash',
        ],
    ])->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed');
});

test('unauthenticated subscription requests receive 401', function (): void {
    $this->getJson('/api/v1/subscriptions')
        ->assertStatus(401)
        ->assertJsonPath('error.code', 'unauthenticated');
});

test('user without subscriptions create permission receives 403', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_CAPTAIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->active()->create();

    $this->postJson('/api/v1/subscriptions', [
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'start_date' => '2026-06-10',
        'payment' => [
            'amount' => '100.00',
            'method' => 'cash',
        ],
    ])->assertStatus(403)
        ->assertJsonPath('error.code', 'forbidden');
});
