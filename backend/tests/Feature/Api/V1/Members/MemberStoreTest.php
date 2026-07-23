<?php

use App\Models\Member;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\MembershipAccessSeeder;
use Illuminate\Testing\Fluent\AssertableJson;
use Laravel\Sanctum\Sanctum;

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(MembershipAccessSeeder::class);
});

test('admin can create a member and receives 201', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $this->postJson('/api/v1/members', [
        'name' => 'Sara Ali',
        'phone' => '+201234567890',
        'email' => 'sara@example.com',
        'gender' => 'female',
        'national_id' => '29504120012345',
        'join_date' => '2026-06-10',
        'notes' => 'VIP member',
    ])
        ->assertStatus(201)
        ->assertJson(fn (AssertableJson $json) => $json
            ->has('data.id')
            ->has('data.name')
            ->has('data.phone')
            ->has('data.status')
            ->has('meta')
            ->has('message')
            ->where('data.name', 'Sara Ali')
            ->where('data.status', 'active')
        );
});

test('created member defaults to active status', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $response = $this->postJson('/api/v1/members', [
        'name' => 'Test Member',
        'phone' => '+201111111111',
    ])->assertStatus(201);

    expect($response->json('data.status'))->toBe('active');
});

test('created_by is set to the authenticated user', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $response = $this->postJson('/api/v1/members', [
        'name' => 'Test Member',
        'phone' => '+201111111111',
    ])->assertStatus(201);

    $memberId = $response->json('data.id');
    $member = Member::find($memberId);
    expect($member->created_by)->toBe($user->id);
});

test('missing required name returns 422', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $this->postJson('/api/v1/members', [
        'phone' => '+201234567890',
    ])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed')
        ->assertJson(fn (AssertableJson $json) => $json
            ->has('error.details.name')
            ->etc()
        );
});

test('missing required phone returns 422', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $this->postJson('/api/v1/members', [
        'name' => 'Sara Ali',
    ])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed')
        ->assertJson(fn (AssertableJson $json) => $json
            ->has('error.details.phone')
            ->etc()
        );
});

test('invalid egyptian phone returns 422', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $this->postJson('/api/v1/members', [
        'name' => 'Sara Ali',
        'phone' => '+201666666666',
    ])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed')
        ->assertJson(fn (AssertableJson $json) => $json
            ->has('error.details.phone')
            ->etc()
        );
});

test('duplicate email returns 422', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    Member::factory()->create(['email' => 'sara@example.com']);

    $this->postJson('/api/v1/members', [
        'name' => 'Sara Ali',
        'phone' => '+201234567890',
        'email' => 'sara@example.com',
    ])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed')
        ->assertJson(fn (AssertableJson $json) => $json
            ->has('error.details.email')
            ->etc()
        );
});

test('duplicate national_id returns 422', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    Member::factory()->create(['national_id' => '29504120012345']);

    $this->postJson('/api/v1/members', [
        'name' => 'Sara Ali',
        'phone' => '+201234567890',
        'national_id' => '29504120012345',
    ])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed')
        ->assertJson(fn (AssertableJson $json) => $json
            ->has('error.details.national_id')
            ->etc()
        );
});

test('invalid egyptian national_id returns 422', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $this->postJson('/api/v1/members', [
        'name' => 'Sara Ali',
        'phone' => '+201234567890',
        'national_id' => '19504120012345',
    ])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed')
        ->assertJson(fn (AssertableJson $json) => $json
            ->has('error.details.national_id')
            ->etc()
        );
});

test('invalid gender value returns 422', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $this->postJson('/api/v1/members', [
        'name' => 'Sara Ali',
        'phone' => '+201234567890',
        'gender' => 'unknown',
    ])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed');
});

test('invalid join_date format returns 422', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $this->postJson('/api/v1/members', [
        'name' => 'Sara Ali',
        'phone' => '+201234567890',
        'join_date' => 'not-a-date',
    ])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed');
});

test('unauthenticated request receives 401', function (): void {
    $this->postJson('/api/v1/members', [
        'name' => 'Sara Ali',
        'phone' => '+201234567890',
    ])
        ->assertStatus(401)
        ->assertJsonPath('error.code', 'unauthenticated');
});

test('user without members.create permission receives 403', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_CAPTAIN);
    Sanctum::actingAs($user);

    $this->postJson('/api/v1/members', [
        'name' => 'Sara Ali',
        'phone' => '+201234567890',
    ])
        ->assertStatus(403)
        ->assertJsonPath('error.code', 'forbidden');
});

test('null email does not conflict with another null email', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    Member::factory()->create(['email' => null]);

    $this->postJson('/api/v1/members', [
        'name' => 'Second Member',
        'phone' => '+201234567891',
    ])->assertStatus(201);
});

test('admin can create a member with initial subscription atomically', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $plan = Plan::factory()->active()->create([
        'price' => '300.00',
        'duration_days' => 30,
    ]);

    $this->postJson('/api/v1/members', [
        'name' => 'Atomic Member',
        'phone' => '+201222222222',
        'join_date' => '2026-06-10',
        'subscription' => [
            'plan_id' => $plan->id,
            'start_date' => '2026-06-10',
            'end_date' => '2026-07-10',
            'discount' => '10.00',
            'payment' => [
                'amount' => '290.00',
                'method' => 'cash',
            ],
        ],
    ])
        ->assertStatus(201)
        ->assertJson(fn (AssertableJson $json) => $json
            ->where('data.name', 'Atomic Member')
            ->where('data.latest_subscription.plan_name', $plan->name)
            ->where('data.latest_subscription.status', 'active')
            ->etc()
        );

    expect(Member::query()->where('name', 'Atomic Member')->count())->toBe(1);
    expect(Subscription::query()->whereHas('member', fn ($query) => $query->where('name', 'Atomic Member'))->count())->toBe(1);
});

test('admin can create a member with custom multi-cycle subscription expiry', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $plan = Plan::factory()->active()->create([
        'price' => '300.00',
        'duration_days' => 30,
    ]);

    $this->postJson('/api/v1/members', [
        'name' => 'Three Month Member',
        'phone' => '+201244444444',
        'join_date' => '2026-06-10',
        'subscription' => [
            'plan_id' => $plan->id,
            'start_date' => '2026-06-10',
            'end_date' => '2026-09-08',
            'discount' => '0.00',
            'payment' => [
                'amount' => '900.00',
                'method' => 'cash',
            ],
        ],
    ])
        ->assertStatus(201)
        ->assertJsonPath('data.latest_subscription.end_date', '2026-09-08');

    $subscription = Subscription::query()
        ->whereHas('member', fn ($query) => $query->where('name', 'Three Month Member'))
        ->first();

    expect($subscription)
        ->not->toBeNull()
        ->and($subscription?->price_paid)->toBe('900.00');
});

test('member is not created when initial subscription creation fails', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $plan = Plan::factory()->active()->create([
        'price' => '300.00',
        'duration_days' => 30,
    ]);

    $this->postJson('/api/v1/members', [
        'name' => 'Should Roll Back',
        'phone' => '+201233333333',
        'join_date' => '2026-06-10',
        'subscription' => [
            'plan_id' => 99999,
            'start_date' => '2026-06-10',
            'end_date' => '2026-07-10',
            'discount' => '10.00',
            'payment' => [
                'amount' => '999.00',
                'method' => 'cash',
            ],
        ],
    ])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed');

    expect(Member::query()->where('name', 'Should Roll Back')->exists())->toBeFalse();
});

test('creating a member with birth_date persists the value', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $response = $this->postJson('/api/v1/members', [
        'name' => 'Birth Date Member',
        'phone' => '+201555555555',
        'birth_date' => '1995-03-15',
    ])->assertStatus(201);

    $memberId = $response->json('data.id');
    $member = Member::find($memberId);

    expect($response->json('data.birth_date'))->toBe('1995-03-15');
    expect($member->birth_date->toDateString())->toBe('1995-03-15');
});

test('creating a member without birth_date succeeds with null', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $response = $this->postJson('/api/v1/members', [
        'name' => 'No Birth',
        'phone' => '+201155555556',
    ])->assertStatus(201);

    expect($response->json('data.birth_date'))->toBeNull();
});

test('duplicate phone on create returns 422', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    Member::factory()->create(['phone' => '+201155555557']);

    $this->postJson('/api/v1/members', [
        'name' => 'Duplicate',
        'phone' => '+201155555557',
    ])->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed');
});
