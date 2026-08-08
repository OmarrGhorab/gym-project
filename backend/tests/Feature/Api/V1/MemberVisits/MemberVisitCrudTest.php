<?php

use App\Actions\MemberVisits\AutoCloseStaleMemberVisits;
use App\Models\Member;
use App\Models\MemberVisit;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\SubscriptionAddon;
use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\MembershipAccessSeeder;
use Illuminate\Support\Carbon;
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

test('member visit is rejected when subscription is invalid', function (): void {
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
        ->assertUnprocessable();

    expect(MemberVisit::count())->toBe(0);
});

test('limited membership sessions are deducted on successful check-in', function (): void {
    $manager = User::factory()->create();
    $manager->assignRole(FoundationPermissions::ROLE_MANAGER);
    Sanctum::actingAs($manager);

    $member = Member::factory()->create();
    $plan = Plan::factory()->active()->create([
        'is_unlimited_sessions' => false,
        'sessions_count' => 8,
        'access_starts_at' => null,
        'access_ends_at' => null,
    ]);
    $subscription = Subscription::factory()->for($member)->for($plan)->active()->create([
        'start_date' => '2026-06-01',
        'end_date' => '2026-06-30',
        'sessions_total' => 8,
        'sessions_remaining' => 8,
    ]);

    $this->postJson('/api/v1/member-visits', [
        'member_id' => $member->id,
        'check_in_at' => '2026-06-10 10:00:00',
    ])
        ->assertCreated()
        ->assertJsonPath('data.status', 'allowed')
        ->assertJsonPath('data.subscription.sessions_remaining', 7);

    expect($subscription->fresh()->sessions_remaining)->toBe(7);
});

test('check-in is rejected when no sessions remain', function (): void {
    $manager = User::factory()->create();
    $manager->assignRole(FoundationPermissions::ROLE_MANAGER);
    Sanctum::actingAs($manager);

    $member = Member::factory()->create();
    $plan = Plan::factory()->active()->create([
        'is_unlimited_sessions' => false,
        'sessions_count' => 8,
    ]);
    Subscription::factory()->for($member)->for($plan)->active()->create([
        'start_date' => '2026-06-01',
        'end_date' => '2026-06-30',
        'sessions_total' => 8,
        'sessions_remaining' => 0,
    ]);

    $this->postJson('/api/v1/member-visits', [
        'member_id' => $member->id,
        'check_in_at' => '2026-06-10 10:00:00',
    ])
        ->assertUnprocessable()
        ->assertJsonFragment(['Membership has no sessions remaining.']);

    expect(MemberVisit::count())->toBe(0);
});

test('check-in is rejected outside plan access hours', function (): void {
    $manager = User::factory()->create();
    $manager->assignRole(FoundationPermissions::ROLE_MANAGER);
    Sanctum::actingAs($manager);

    $member = Member::factory()->create();
    $plan = Plan::factory()->active()->create([
        'access_starts_at' => '19:00',
        'access_ends_at' => '23:00',
        'is_unlimited_sessions' => true,
        'sessions_count' => null,
    ]);
    Subscription::factory()->for($member)->for($plan)->active()->create([
        'start_date' => '2026-06-01',
        'end_date' => '2026-06-30',
        'sessions_remaining' => null,
    ]);

    // Before window
    $this->postJson('/api/v1/member-visits', [
        'member_id' => $member->id,
        'check_in_at' => '2026-06-10 18:30:00',
    ])
        ->assertUnprocessable()
        ->assertJsonPath('error.details.member_id.0', 'Membership access is only allowed between 19:00 and 23:00. Check-in is outside that window.');

    // Inside window
    $this->postJson('/api/v1/member-visits', [
        'member_id' => $member->id,
        'check_in_at' => '2026-06-10 20:00:00',
    ])
        ->assertCreated()
        ->assertJsonPath('data.status', 'allowed');
});

test('add-on sessions and access hours are enforced when provided', function (): void {
    $manager = User::factory()->create();
    $manager->assignRole(FoundationPermissions::ROLE_MANAGER);
    Sanctum::actingAs($manager);

    $member = Member::factory()->create();
    $gymPlan = Plan::factory()->active()->create([
        'category' => 'gym_access',
        'is_unlimited_sessions' => true,
        'sessions_count' => null,
        'access_starts_at' => null,
        'access_ends_at' => null,
    ]);
    $ptPlan = Plan::factory()->active()->create([
        'category' => 'personal_training',
        'is_unlimited_sessions' => false,
        'sessions_count' => 8,
        'access_starts_at' => '19:00',
        'access_ends_at' => '23:00',
    ]);
    $subscription = Subscription::factory()->for($member)->for($gymPlan)->active()->create([
        'start_date' => '2026-06-01',
        'end_date' => '2026-06-30',
        'sessions_remaining' => null,
    ]);
    $addon = SubscriptionAddon::query()->create([
        'subscription_id' => $subscription->id,
        'member_id' => $member->id,
        'plan_id' => $ptPlan->id,
        'coach_id' => null,
        'start_date' => '2026-06-01',
        'end_date' => '2026-06-30',
        'status' => 'active',
        'price_paid' => '500.00',
        'discount' => '0.00',
        'sessions_total' => 8,
        'sessions_remaining' => 8,
    ]);

    // Outside add-on hours
    $this->postJson('/api/v1/member-visits', [
        'member_id' => $member->id,
        'subscription_addon_id' => $addon->id,
        'check_in_at' => '2026-06-10 10:00:00',
    ])->assertUnprocessable();

    // Inside add-on hours — deducts add-on session
    $this->postJson('/api/v1/member-visits', [
        'member_id' => $member->id,
        'subscription_addon_id' => $addon->id,
        'check_in_at' => '2026-06-10 20:00:00',
    ])
        ->assertCreated()
        ->assertJsonPath('data.subscription_addon.sessions_remaining', 7);

    expect($addon->fresh()->sessions_remaining)->toBe(7);
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

test('day sheet lists every visit of the day with plan, monthly tally and plan end date', function (): void {
    $manager = User::factory()->create();
    $manager->assignRole(FoundationPermissions::ROLE_MANAGER);
    Sanctum::actingAs($manager);

    $member = Member::factory()->create();
    $plan = Plan::factory()->active()->create(['name' => 'Gold']);
    Subscription::factory()->for($member)->for($plan)->active()->create([
        'start_date' => '2026-06-01',
        'end_date' => '2026-06-30',
    ]);

    // Two earlier visits this month plus today's, so the tally is 3 and not just today's.
    MemberVisit::factory()->for($member)->count(2)->create([
        'check_in_at' => Carbon::parse('2026-06-10 09:00:00'),
        'status' => 'allowed',
    ]);
    MemberVisit::factory()->for($member)->create([
        'check_in_at' => Carbon::parse('2026-06-26 10:00:00'),
        'status' => 'allowed',
    ]);
    // A different month must not leak into the count.
    MemberVisit::factory()->for($member)->create([
        'check_in_at' => Carbon::parse('2026-05-20 09:00:00'),
        'status' => 'allowed',
    ]);

    $this->getJson('/api/v1/member-visits?filter[from]=2026-06-26&filter[to]=2026-06-26')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.plan_name', 'Gold')
        ->assertJsonPath('data.0.plan_end_date', '2026-06-30')
        ->assertJsonPath('data.0.member.visits_this_month', 3);
});

test('day sheet returns more than the default page when per_page is raised', function (): void {
    $manager = User::factory()->create();
    $manager->assignRole(FoundationPermissions::ROLE_MANAGER);
    Sanctum::actingAs($manager);

    // Regression: the index hard-coded paginate(15), so a busy day was silently truncated.
    $member = Member::factory()->create();
    MemberVisit::factory()->for($member)->count(20)->create([
        'check_in_at' => Carbon::parse('2026-06-26 10:00:00'),
    ]);

    $this->getJson('/api/v1/member-visits?filter[from]=2026-06-26&filter[to]=2026-06-26&per_page=100')
        ->assertOk()
        ->assertJsonCount(20, 'data')
        ->assertJsonPath('meta.per_page', 100);
});

test('member cannot check in again while an earlier visit is still open', function (): void {
    $manager = User::factory()->create();
    $manager->assignRole(FoundationPermissions::ROLE_MANAGER);
    Sanctum::actingAs($manager);

    $member = Member::factory()->create();
    Subscription::factory()->for($member)->active()->create([
        'start_date' => '2026-06-01',
        'end_date' => '2026-06-30',
    ]);

    MemberVisit::factory()->for($member)->create([
        'check_in_at' => Carbon::parse('2026-06-26 10:00:00'),
        'check_out_at' => null,
    ]);

    $this->postJson('/api/v1/member-visits', [
        'member_id' => $member->id,
        'check_in_at' => '2026-06-26 10:30:00',
    ])
        ->assertUnprocessable()
        ->assertJsonFragment([
            'member_id' => ['This member already has an open visit. Check them out before checking in again.'],
        ]);

    expect(MemberVisit::where('member_id', $member->id)->count())->toBe(1);
});

test('stale open member visits are auto checked out after ninety minutes on next check in', function (): void {
    $manager = User::factory()->create();
    $manager->assignRole(FoundationPermissions::ROLE_MANAGER);
    Sanctum::actingAs($manager);

    $staleMember = Member::factory()->create();
    $newMember = Member::factory()->create();
    Subscription::factory()->for($newMember)->active()->create([
        'start_date' => '2026-06-01',
        'end_date' => '2026-06-30',
    ]);

    $staleVisit = MemberVisit::factory()->for($staleMember)->create([
        'check_in_at' => Carbon::parse('2026-06-26 11:00:00'),
        'check_out_at' => null,
        'notes' => 'Forgot checkout.',
    ]);

    $this->postJson('/api/v1/member-visits', [
        'member_id' => $newMember->id,
        'check_in_at' => '2026-06-26 12:45:00',
    ])->assertCreated();

    $staleVisit->refresh();

    expect($staleVisit->check_out_at?->toDateTimeString())->toBe('2026-06-26 12:30:00')
        ->and($staleVisit->notes)->toContain('Forgot checkout.')
        ->and($staleVisit->notes)->toContain(AutoCloseStaleMemberVisits::SYSTEM_NOTE);
});

test('member visit auto close command closes stale open visits', function (): void {
    $member = Member::factory()->create();
    $staleVisit = MemberVisit::factory()->for($member)->create([
        'check_in_at' => Carbon::parse('2026-06-26 23:00:00'),
        'check_out_at' => null,
        'notes' => null,
    ]);

    Carbon::setTestNow('2026-06-27 00:45:00');

    $this->artisan('member-visits:auto-close')
        ->expectsOutput('Auto-closed 1 member visit(s).')
        ->assertSuccessful();

    $staleVisit->refresh();

    expect($staleVisit->check_out_at?->toDateTimeString())->toBe('2026-06-27 00:30:00')
        ->and($staleVisit->notes)->toBe(AutoCloseStaleMemberVisits::SYSTEM_NOTE);
});
