<?php

use App\Models\Member;
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
