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
