<?php

use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Illuminate\Testing\Fluent\AssertableJson;
use Laravel\Sanctum\Sanctum;

/**
 * US3 — Enforce Role-Based Access: protected sample endpoint
 *
 * Covers:
 *  - Authenticated user WITH permission → 200 with allowed: true
 *  - Authenticated user WITHOUT permission → 403 stable error envelope
 *  - Unauthenticated request → 401 stable error envelope
 */
beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
});

test('admin user with permission can access protected sample endpoint', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);

    Sanctum::actingAs($user);

    $this->getJson('/api/v1/foundation/protected-sample')
        ->assertStatus(200)
        ->assertJson(fn (AssertableJson $json) => $json
            ->has('data')
            ->has('meta')
            ->has('message')
            ->where('data.allowed', true)
        );
});

test('user with direct permission can access protected sample endpoint', function (): void {
    $user = User::factory()->create();
    $user->givePermissionTo(FoundationPermissions::PERM_ACCESS_SAMPLE);

    Sanctum::actingAs($user);

    $this->getJson('/api/v1/foundation/protected-sample')
        ->assertStatus(200)
        ->assertJsonPath('data.allowed', true);
});

test('authenticated user without permission receives 403', function (): void {
    // Create user with a non-Admin role that does not have the permission.
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_CASHIER);

    Sanctum::actingAs($user);

    $this->getJson('/api/v1/foundation/protected-sample')
        ->assertStatus(403)
        ->assertJson(fn (AssertableJson $json) => $json
            ->has('error.code')
            ->has('error.message')
            ->where('error.code', 'forbidden')
        );
});

test('unauthenticated request receives 401', function (): void {
    $this->getJson('/api/v1/foundation/protected-sample')
        ->assertStatus(401)
        ->assertJson(fn (AssertableJson $json) => $json
            ->where('error.code', 'unauthenticated')
        );
});

test('403 response uses stable error envelope shape', function (): void {
    $user = User::factory()->create();
    // No role — no permissions.

    Sanctum::actingAs($user);

    $this->getJson('/api/v1/foundation/protected-sample')
        ->assertStatus(403)
        ->assertJsonStructure([
            'error' => ['code', 'message', 'details'],
        ]);
});
