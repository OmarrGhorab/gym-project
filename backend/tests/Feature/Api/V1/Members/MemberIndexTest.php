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
            ->etc()
        );
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
