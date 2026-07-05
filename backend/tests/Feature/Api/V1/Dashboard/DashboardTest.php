<?php

use App\Models\Member;
use App\Models\Plan;
use App\Models\Setting;
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

test('dashboard active subscriptions endpoint returns active subscription count', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->active()->create();

    Subscription::factory()->active()->count(2)->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
    ]);

    Subscription::factory()->frozen()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
    ]);

    $this->getJson('/api/v1/dashboard/active-subscriptions')
        ->assertStatus(200)
        ->assertJsonPath('data.count', 2);
});

test('dashboard expiring soon endpoint returns in window subscriptions with pagination', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    Setting::create([
        'key' => 'reminder_days',
        'value' => 7,
    ]);

    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->active()->create();

    $inWindow = Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'end_date' => '2026-06-15',
        'last_reminded_on' => '2026-06-10',
    ]);

    $otherMember = Member::factory()->active()->create();

    Subscription::factory()->active()->create([
        'member_id' => $otherMember->id,
        'plan_id' => $plan->id,
        'end_date' => '2026-06-30',
        'last_reminded_on' => null,
    ]);

    $this->getJson('/api/v1/dashboard/expiring-soon')
        ->assertStatus(200)
        ->assertJsonPath('data.0.id', $inWindow->id)
        ->assertJsonPath('meta.current_page', 1)
        ->assertJsonPath('meta.per_page', 15)
        ->assertJsonPath('meta.total', 1)
        ->assertJsonStructure([
            'data',
            'meta' => ['current_page', 'per_page', 'total', 'last_page'],
            'message',
        ]);
});

test('dashboard expiring soon excludes subscriptions that already have a later active renewal', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    Setting::create([
        'key' => 'reminder_days',
        'value' => 7,
    ]);

    $member = Member::factory()->active()->create();
    $plan = Plan::factory()->active()->create();

    Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'start_date' => '2026-05-16',
        'end_date' => '2026-06-15',
    ]);

    Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'start_date' => '2026-06-16',
        'end_date' => '2026-09-14',
    ]);

    $this->getJson('/api/v1/dashboard/expiring-soon')
        ->assertStatus(200)
        ->assertJsonPath('meta.total', 0)
        ->assertJsonCount(0, 'data');
});

test('dashboard expiring soon endpoint returns 401 when unauthenticated', function (): void {
    $this->getJson('/api/v1/dashboard/expiring-soon')
        ->assertStatus(401)
        ->assertJsonPath('error.code', 'unauthenticated');
});

test('user without dashboard permission receives 403', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_CASHIER);
    Sanctum::actingAs($user);

    $this->getJson('/api/v1/dashboard/active-subscriptions')
        ->assertStatus(403)
        ->assertJsonPath('error.code', 'forbidden');
});
