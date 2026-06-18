<?php

use App\Models\Member;
use App\Models\Payment;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\MembershipAccessSeeder;
use Illuminate\Testing\Fluent\AssertableJson;
use Laravel\Sanctum\Sanctum;
use Spatie\Activitylog\Models\Activity;

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(MembershipAccessSeeder::class);
});

// ------- show -------

test('admin can show a member', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->create(['name' => 'Sara Ali']);

    $this->getJson("/api/v1/members/{$member->id}")
        ->assertStatus(200)
        ->assertJson(fn (AssertableJson $json) => $json
            ->has('data.id')
            ->has('data.name')
            ->has('meta')
            ->has('message')
            ->where('data.id', $member->id)
            ->where('data.name', 'Sara Ali')
        );
});

test('member show includes aggregate total paid for their subscriptions', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->create();
    $otherMember = Member::factory()->create();
    $plan = Plan::factory()->active()->create();

    $subscription = Subscription::factory()->active()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
    ]);

    $otherSubscription = Subscription::factory()->active()->create([
        'member_id' => $otherMember->id,
        'plan_id' => $plan->id,
    ]);

    Payment::factory()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $subscription->id,
        'amount' => '125.50',
    ]);

    Payment::factory()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $subscription->id,
        'amount' => '74.50',
    ]);

    Payment::factory()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $otherSubscription->id,
        'amount' => '999.00',
    ]);

    $this->getJson("/api/v1/members/{$member->id}")
        ->assertStatus(200)
        ->assertJsonPath('data.total_paid', '200.00');
});

test('show returns 404 for non-existent member', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $this->getJson('/api/v1/members/9999')
        ->assertStatus(404)
        ->assertJsonPath('error.code', 'not_found');
});

test('unauthenticated show receives 401', function (): void {
    $member = Member::factory()->create();

    $this->getJson("/api/v1/members/{$member->id}")
        ->assertStatus(401);
});

test('show without permission receives 403', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_CAPTAIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->create();

    $this->getJson("/api/v1/members/{$member->id}")
        ->assertStatus(403)
        ->assertJsonPath('error.code', 'forbidden');
});

// ------- update -------

test('admin can update member fields', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->create(['name' => 'Old Name']);

    $this->putJson("/api/v1/members/{$member->id}", [
        'name' => 'New Name',
        'phone' => $member->phone,
    ])
        ->assertStatus(200)
        ->assertJson(fn (AssertableJson $json) => $json
            ->where('data.name', 'New Name')
            ->etc()
        );
});

test('admin can update all editable member fields and receives them back', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->create([
        'name' => 'Old Name',
        'phone' => '+201000000001',
        'email' => 'old@example.com',
        'gender' => 'male',
        'national_id' => '29501010000001',
        'join_date' => '2026-01-01',
        'notes' => 'Old notes',
        'status' => 'active',
    ]);

    $this->putJson("/api/v1/members/{$member->id}", [
        'name' => 'New Name',
        'phone' => '+201000000002',
        'email' => 'new@example.com',
        'gender' => 'female',
        'national_id' => '29501010000002',
        'join_date' => '2026-02-02',
        'notes' => 'Updated notes',
        'status' => 'inactive',
    ])
        ->assertStatus(200)
        ->assertJson(fn (AssertableJson $json) => $json
            ->where('data.name', 'New Name')
            ->where('data.phone', '+201000000002')
            ->where('data.email', 'new@example.com')
            ->where('data.gender', 'female')
            ->where('data.national_id', '29501010000002')
            ->where('data.join_date', '2026-02-02')
            ->where('data.notes', 'Updated notes')
            ->where('data.status', 'inactive')
            ->etc()
        );
});

test('member audit log does not store sensitive pii values', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->create([
        'phone' => '+201234567890',
        'email' => 'sara@example.com',
        'national_id' => '29504120012345',
        'notes' => 'Sensitive note',
    ]);

    $this->putJson("/api/v1/members/{$member->id}", [
        'name' => $member->name,
        'phone' => '+201111111111',
        'email' => 'updated@example.com',
        'national_id' => '29999999999999',
        'notes' => 'Updated sensitive note',
    ])->assertStatus(200);

    $propertiesJson = Activity::query()
        ->where('subject_type', Member::class)
        ->latest()
        ->value('properties')
        ->toJson();

    expect($propertiesJson)
        ->not->toContain('+201234567890')
        ->not->toContain('+201111111111')
        ->not->toContain('sara@example.com')
        ->not->toContain('updated@example.com')
        ->not->toContain('29504120012345')
        ->not->toContain('29999999999999')
        ->not->toContain('Sensitive note')
        ->not->toContain('Updated sensitive note');
});

test('update returns 404 for non-existent member', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $this->putJson('/api/v1/members/9999', [
        'name' => 'New Name',
        'phone' => '+201234567890',
    ])
        ->assertStatus(404)
        ->assertJsonPath('error.code', 'not_found');
});

test('update duplicate email returns 422', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    Member::factory()->create(['email' => 'taken@example.com']);
    $member = Member::factory()->create(['email' => 'other@example.com']);

    $this->putJson("/api/v1/members/{$member->id}", [
        'name' => $member->name,
        'phone' => $member->phone,
        'email' => 'taken@example.com',
    ])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed');
});

test('update own email passes unique check', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->create(['email' => 'sara@example.com']);

    $this->putJson("/api/v1/members/{$member->id}", [
        'name' => 'Sara Updated',
        'phone' => $member->phone,
        'email' => 'sara@example.com',
    ])
        ->assertStatus(200);
});

test('update invalid egyptian phone returns 422', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->create();

    $this->putJson("/api/v1/members/{$member->id}", [
        'name' => $member->name,
        'phone' => '+201666666666',
    ])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed')
        ->assertJson(fn (AssertableJson $json) => $json
            ->has('error.details.phone')
            ->etc()
        );
});

test('update invalid egyptian national_id returns 422', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->create();

    $this->putJson("/api/v1/members/{$member->id}", [
        'name' => $member->name,
        'phone' => $member->phone,
        'national_id' => '19504120012345',
    ])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed')
        ->assertJson(fn (AssertableJson $json) => $json
            ->has('error.details.national_id')
            ->etc()
        );
});

test('update without members.update permission receives 403', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_CAPTAIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->create();

    $this->putJson("/api/v1/members/{$member->id}", [
        'name' => 'New Name',
        'phone' => $member->phone,
    ])
        ->assertStatus(403)
        ->assertJsonPath('error.code', 'forbidden');
});

// ------- destroy (deactivate) -------

test('admin can deactivate a member via DELETE', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->create(['status' => 'active']);

    $this->deleteJson("/api/v1/members/{$member->id}")
        ->assertStatus(200)
        ->assertJsonPath('data.status', 'inactive');

    $member->refresh();
    expect($member->status)->toBe('inactive');
});

test('deactivate sets status to inactive not hard delete', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->create(['status' => 'active']);

    $this->deleteJson("/api/v1/members/{$member->id}")
        ->assertStatus(200);

    $this->assertDatabaseHas('members', ['id' => $member->id, 'status' => 'inactive']);
});

test('deactivate returns 404 for non-existent member', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $this->deleteJson('/api/v1/members/9999')
        ->assertStatus(404);
});

test('deactivate without members.delete permission receives 403', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_CASHIER);
    Sanctum::actingAs($user);

    $member = Member::factory()->create();

    $this->deleteJson("/api/v1/members/{$member->id}")
        ->assertStatus(403)
        ->assertJsonPath('error.code', 'forbidden');
});
