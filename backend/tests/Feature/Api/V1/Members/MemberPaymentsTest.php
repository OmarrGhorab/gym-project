<?php

use App\Models\Member;
use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\MembershipAccessSeeder;
use Illuminate\Testing\Fluent\AssertableJson;
use Laravel\Sanctum\Sanctum;

/*
|--------------------------------------------------------------------------
| Member Payments Test — GET /members/{id}/payments
|--------------------------------------------------------------------------
|
| Graceful-degradation note: the Payment model and `payments` table are
| owned by Track A / US5 (T070–T076) and do NOT exist yet in this branch.
| These tests verify the endpoint responds correctly in both the
| "no payments" case (which works now) and document the expected shape
| for when payments are wired in.
|
| Tests that depend on real Payment records are marked with a TODO comment
| and test the empty-collection fallback for now.
|
*/

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(MembershipAccessSeeder::class);
});

test('admin can fetch member payments and receives paginated envelope', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->create();

    $this->getJson("/api/v1/members/{$member->id}/payments")
        ->assertStatus(200)
        ->assertJson(fn (AssertableJson $json) => $json
            ->has('data')
            ->has('meta')
            ->has('message')
        );
});

test('member payments returns empty collection when no payments exist', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->create();

    $response = $this->getJson("/api/v1/members/{$member->id}/payments")
        ->assertStatus(200);

    // Graceful degradation: payments table may not exist yet; empty array expected.
    $data = $response->json('data');
    expect($data)->toBeArray()->toBeEmpty();
});

test('member payments returns 404 for non-existent member', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $this->getJson('/api/v1/members/9999/payments')
        ->assertStatus(404)
        ->assertJsonPath('error.code', 'not_found');
});

test('unauthenticated request receives 401', function (): void {
    $member = Member::factory()->create();

    $this->getJson("/api/v1/members/{$member->id}/payments")
        ->assertStatus(401)
        ->assertJsonPath('error.code', 'unauthenticated');
});

test('user without payments.view permission receives 403', function (): void {
    // Captain role has only subscriptions.view — no payments.view
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_CAPTAIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->create();

    $this->getJson("/api/v1/members/{$member->id}/payments")
        ->assertStatus(403)
        ->assertJsonPath('error.code', 'forbidden');
});

test('accountant with payments.view can fetch member payments', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ACCOUNTANT);
    Sanctum::actingAs($user);

    $member = Member::factory()->create();

    $this->getJson("/api/v1/members/{$member->id}/payments")
        ->assertStatus(200);
});
