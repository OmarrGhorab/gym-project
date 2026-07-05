<?php

use App\Models\Member;
use App\Models\MemberVisit;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\MembershipAccessSeeder;
use Laravel\Sanctum\Sanctum;

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(MembershipAccessSeeder::class);
});

test('member visit records allowed active subscription visits', function (): void {
    $manager = User::factory()->create();
    $manager->assignRole(FoundationPermissions::ROLE_MANAGER);
    Sanctum::actingAs($manager);

    $member = Member::factory()->create();
    $subscription = Subscription::factory()->for($member)->active()->create([
        'start_date' => '2026-06-01',
        'end_date' => '2026-06-30',
    ]);

    $this->postJson('/api/v1/member-visits', [
        'member_id' => $member->id,
        'check_in_at' => '2026-06-26 10:00:00',
    ])
        ->assertCreated()
        ->assertJsonPath('data.status', 'allowed')
        ->assertJsonPath('data.subscription_id', $subscription->id);
});

test('member visit records blocked visits when subscription is invalid', function (): void {
    $manager = User::factory()->create();
    $manager->assignRole(FoundationPermissions::ROLE_MANAGER);
    Sanctum::actingAs($manager);

    $member = Member::factory()->create();
    Subscription::factory()->for($member)->expired()->create([
        'start_date' => '2026-05-01',
        'end_date' => '2026-05-31',
    ]);

    $this->postJson('/api/v1/member-visits', [
        'member_id' => $member->id,
        'check_in_at' => '2026-06-26 10:00:00',
    ])
        ->assertCreated()
        ->assertJsonPath('data.status', 'blocked')
        ->assertJsonPath('data.subscription_id', null);

    expect(MemberVisit::first()->alert_reason)->not->toBeNull();
});

test('member visit allows access during plan grace days after subscription end', function (): void {
    $manager = User::factory()->create();
    $manager->assignRole(FoundationPermissions::ROLE_MANAGER);
    Sanctum::actingAs($manager);

    $member = Member::factory()->create();
    $plan = Plan::factory()->active()->create(['access_grace_days' => 3]);
    $subscription = Subscription::factory()->for($member)->for($plan)->active()->create([
        'start_date' => '2026-06-01',
        'end_date' => '2026-06-30',
    ]);

    $this->postJson('/api/v1/member-visits', [
        'member_id' => $member->id,
        'check_in_at' => '2026-07-03 10:00:00',
    ])
        ->assertCreated()
        ->assertJsonPath('data.status', 'allowed')
        ->assertJsonPath('data.subscription_id', $subscription->id);
});

test('member visits can be listed by member', function (): void {
    $manager = User::factory()->create();
    $manager->assignRole(FoundationPermissions::ROLE_MANAGER);
    Sanctum::actingAs($manager);

    $member = Member::factory()->create();
    MemberVisit::factory()->count(2)->for($member)->create();
    MemberVisit::factory()->create();

    $this->getJson("/api/v1/member-visits?filter[member_id]={$member->id}")
        ->assertOk()
        ->assertJsonCount(2, 'data');
});
