<?php

use App\Models\Member;
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
        ->assertStatus(200);

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
