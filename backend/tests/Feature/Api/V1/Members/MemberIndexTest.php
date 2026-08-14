<?php

use App\Models\Member;
use App\Models\MemberVisit;
use App\Models\Payment;
use App\Models\Subscription;
use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\MembershipAccessSeeder;
use Illuminate\Support\Carbon;
use Illuminate\Testing\Fluent\AssertableJson;
use Laravel\Sanctum\Sanctum;

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(MembershipAccessSeeder::class);
});

test('admin can list members with pagination envelope', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    Member::factory()->count(3)->create();

    $this->getJson('/api/v1/members')
        ->assertStatus(200)
        ->assertJson(fn (AssertableJson $json) => $json
            ->has('data')
            ->has('meta')
            ->has('message')
            ->has('meta.current_page')
            ->has('meta.per_page')
            ->has('meta.total')
            ->has('meta.last_page')
        );
});

test('member list returns correct data shape', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    Member::factory()->create(['name' => 'Sara Ali', 'status' => 'active']);

    $this->getJson('/api/v1/members')
        ->assertStatus(200)
        ->assertJson(fn (AssertableJson $json) => $json
            ->has('data.0.id')
            ->has('data.0.name')
            ->has('data.0.phone')
            ->has('data.0.status')
            ->has('data.0.visits_this_month')
            ->etc()
        );
});

test('member list includes visits this month count', function (): void {
    Carbon::setTestNow('2026-06-15 12:00:00');

    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->create(['name' => 'Visit Counter']);
    MemberVisit::factory()->for($member)->create([
        'check_in_at' => '2026-06-10 10:00:00',
        'status' => 'allowed',
    ]);
    MemberVisit::factory()->for($member)->create([
        'check_in_at' => '2026-06-12 11:00:00',
        'status' => 'flagged',
    ]);
    MemberVisit::factory()->for($member)->create([
        'check_in_at' => '2026-05-20 10:00:00',
        'status' => 'allowed',
    ]);

    $this->getJson('/api/v1/members?filter[search]=Visit%20Counter')
        ->assertStatus(200)
        ->assertJsonPath('data.0.visits_this_month', 2);

    Carbon::setTestNow();
});

test('member list exposes backend membership and billing statuses', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    Member::factory()->create([
        'name' => 'No Subscription Member',
        'phone' => '+201000000001',
    ]);

    $paidMember = Member::factory()->create([
        'name' => 'Paid Subscription Member',
        'phone' => '+201000000002',
    ]);
    $paidSubscription = Subscription::factory()->for($paidMember)->active()->create();
    Payment::factory()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $paidSubscription->id,
        'status' => 'paid',
    ]);

    $overdueMember = Member::factory()->create([
        'name' => 'Overdue Subscription Member',
        'phone' => '+201000000003',
    ]);
    $overdueSubscription = Subscription::factory()->for($overdueMember)->active()->create();
    Payment::factory()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $overdueSubscription->id,
        'paid_at' => null,
        'status' => 'due',
        'due_date' => now()->subDay()->toDateString(),
    ]);

    $members = collect($this->getJson('/api/v1/members?per_page=10')
        ->assertStatus(200)
        ->json('data'))->keyBy('name');

    expect($members['No Subscription Member']['membership_status'])->toBeNull()
        ->and($members['No Subscription Member']['billing_status'])->toBe('trial')
        ->and($members['Paid Subscription Member']['membership_status'])->toBe('active')
        ->and($members['Paid Subscription Member']['billing_status'])->toBe('paid')
        ->and($members['Overdue Subscription Member']['membership_status'])->toBe('active')
        ->and($members['Overdue Subscription Member']['billing_status'])->toBe('overdue');
});

test('member list filters session timing renewal attention on the latest subscription', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $sessionsFinishedMember = Member::factory()->create(['name' => 'Sessions Finished Early']);
    Subscription::factory()->for($sessionsFinishedMember)->active()->create([
        'start_date' => now()->subDay()->toDateString(),
        'end_date' => now()->addDays(29)->toDateString(),
        'sessions_total' => 10,
        'sessions_remaining' => 0,
    ]);

    $periodEndedMember = Member::factory()->create(['name' => 'Period Ended With Sessions']);
    Subscription::factory()->for($periodEndedMember)->active()->create([
        'start_date' => now()->subDays(31)->toDateString(),
        'end_date' => now()->subDay()->toDateString(),
        'sessions_total' => 10,
        'sessions_remaining' => 3,
    ]);

    $onTrackMember = Member::factory()->create(['name' => 'Sessions On Track']);
    Subscription::factory()->for($onTrackMember)->active()->create([
        'start_date' => now()->subDay()->toDateString(),
        'end_date' => now()->addDays(29)->toDateString(),
        'sessions_total' => 10,
        'sessions_remaining' => 6,
    ]);

    $this->getJson('/api/v1/members?filter[renewal_attention]=sessions_exhausted')
        ->assertStatus(200)
        ->assertJsonPath('meta.total', 1)
        ->assertJsonPath('data.0.name', 'Sessions Finished Early')
        ->assertJsonPath('data.0.latest_subscription.days_left', 29)
        ->assertJsonPath('data.0.latest_subscription.sessions_remaining', 0)
        ->assertJsonPath('data.0.latest_subscription.renewal_health', 'sessions_exhausted');

    $this->getJson('/api/v1/members?filter[renewal_attention]=period_ended_sessions_left')
        ->assertStatus(200)
        ->assertJsonPath('meta.total', 1)
        ->assertJsonPath('data.0.name', 'Period Ended With Sessions')
        ->assertJsonPath('data.0.latest_subscription.sessions_remaining', 3)
        ->assertJsonPath('data.0.latest_subscription.renewal_health', 'period_ended_sessions_left');
});

test('frozen member filter checks the latest subscription instead of old history', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $currentlyFrozen = Member::factory()->create(['name' => 'Currently Frozen']);
    Subscription::factory()->for($currentlyFrozen)->frozen()->create();

    $previouslyFrozen = Member::factory()->create(['name' => 'Previously Frozen']);
    Subscription::factory()->for($previouslyFrozen)->frozen()->create(['created_at' => now()->subDay()]);
    Subscription::factory()->for($previouslyFrozen)->active()->create(['created_at' => now()]);

    $response = $this->getJson('/api/v1/members?filter[subscription_status]=frozen')
        ->assertOk()
        ->assertJsonPath('meta.total', 1);

    expect(collect($response->json('data'))->pluck('name')->all())->toBe(['Currently Frozen']);
});

test('member list honors requested per page size', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    foreach (range(1, 55) as $index) {
        Member::query()->create([
            'email' => "per-page-{$index}@example.test",
            'gender' => 'male',
            'join_date' => now()->toDateString(),
            'name' => "Per Page Member {$index}",
            'national_id' => sprintf('2%013d', $index),
            'phone' => sprintf('+2010001%06d', $index),
            'status' => 'active',
        ]);
    }

    $response = $this->getJson('/api/v1/members?per_page=50')
        ->assertStatus(200)
        ->assertJsonPath('meta.per_page', 50)
        ->assertJsonPath('meta.total', 55);

    expect($response->json('data'))->toHaveCount(50);
});

test('member list can filter by status active', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    Member::factory()->create(['status' => 'active']);
    Member::factory()->create(['status' => 'inactive']);

    $response = $this->getJson('/api/v1/members?filter[status]=active')
        ->assertStatus(200);

    $data = $response->json('data');
    expect(count($data))->toBe(1)
        ->and($data[0]['status'])->toBe('active');
});

test('member list can filter by status inactive', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    Member::factory()->create(['status' => 'active']);
    Member::factory()->create(['status' => 'inactive']);

    $response = $this->getJson('/api/v1/members?filter[status]=inactive')
        ->assertStatus(200);

    $data = $response->json('data');
    expect(count($data))->toBe(1)
        ->and($data[0]['status'])->toBe('inactive');
});

test('member list can search by name', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    Member::factory()->create(['name' => 'Sara Ali']);
    Member::factory()->create(['name' => 'John Doe']);

    $response = $this->getJson('/api/v1/members?filter[search]=Sara')
        ->assertStatus(200);

    $data = $response->json('data');
    expect(count($data))->toBe(1)
        ->and($data[0]['name'])->toBe('Sara Ali');
});

test('member list normalizes arabic name variants while searching', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    Member::factory()->create(['name' => 'على حسن']);
    Member::factory()->create(['name' => 'محمد حسن']);

    $response = $this->getJson('/api/v1/members?filter[search]='.rawurlencode('علي'))
        ->assertStatus(200);

    $data = $response->json('data');
    expect(count($data))->toBe(1)
        ->and($data[0]['name'])->toBe('على حسن');
});

test('member list can search by phone', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    Member::factory()->create(['phone' => '+201234567890']);
    Member::factory()->create(['phone' => '+441234567890']);

    $response = $this->getJson('/api/v1/members?filter[search]=+2012')
        ->assertStatus(200);

    $data = $response->json('data');
    expect(count($data))->toBe(1);
});

test('member list can search by id', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->create(['name' => 'Lookup By Id Member']);
    Member::factory()->create(['name' => 'Another Member']);

    $response = $this->getJson('/api/v1/members?filter[search]='.$member->id)
        ->assertStatus(200);

    $data = $response->json('data');
    expect(count($data))->toBe(1)
        ->and($data[0]['id'])->toBe($member->id);
});

test('member list can search by attendance qr token', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->create([
        'attendance_code' => 'ABC12345',
        'name' => 'Lookup By Code Member',
    ]);
    Member::factory()->create(['name' => 'Another Member']);

    $response = $this->getJson('/api/v1/members?filter[search]=member:ABC12345')
        ->assertStatus(200);

    $data = $response->json('data');
    expect(count($data))->toBe(1)
        ->and($data[0]['id'])->toBe($member->id);
});

test('unauthenticated request receives 401', function (): void {
    $this->getJson('/api/v1/members')
        ->assertStatus(401)
        ->assertJsonPath('error.code', 'unauthenticated');
});

test('user without members.view permission receives 403', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_CAPTAIN);
    Sanctum::actingAs($user);

    $this->getJson('/api/v1/members')
        ->assertStatus(403)
        ->assertJsonPath('error.code', 'forbidden');
});

test('cashier with members.view can list members', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_CASHIER);
    Sanctum::actingAs($user);

    $this->getJson('/api/v1/members')
        ->assertStatus(200);
});
