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

test('member can have multiple active subscriptions with different plans', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->active()->create();
    $plan1 = Plan::factory()->active()->create(['price' => '100.00']);
    $plan2 = Plan::factory()->active()->create(['price' => '200.00']);

    // Create first subscription
    $this->postJson('/api/v1/subscriptions', [
        'member_id' => $member->id,
        'plan_id' => $plan1->id,
        'start_date' => '2026-06-01',
        'payment' => [
            'amount' => '100.00',
            'method' => 'cash',
        ],
    ])->assertStatus(201);

    // Create second subscription (different plan)
    $this->postJson('/api/v1/subscriptions', [
        'member_id' => $member->id,
        'plan_id' => $plan2->id,
        'start_date' => '2026-06-01',
        'payment' => [
            'amount' => '200.00',
            'method' => 'card',
        ],
    ])->assertStatus(201);
});

test('setting max_freeze_days to 0 disallows freezing', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->active()->create(['max_freeze_days' => 0]);
    $subscription = Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'sold_by_user_id' => $user->id,
    ]);

    $this->postJson("/api/v1/subscriptions/{$subscription->id}/freeze", [
        'freeze_start' => '2026-06-10',
        'freeze_end' => '2026-06-12',
        'reason' => 'travel',
    ])->assertStatus(422);
});
