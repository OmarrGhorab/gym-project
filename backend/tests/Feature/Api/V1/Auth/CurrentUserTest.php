<?php

use App\Models\User;
use Illuminate\Testing\Fluent\AssertableJson;
use Laravel\Sanctum\Sanctum;

/**
 * US2 — Authenticate Staff Users: Current User
 *
 * Covers:
 *  - Authenticated request → 200 with user data in envelope
 *  - Unauthenticated request → 401 stable error envelope
 */
test('me endpoint returns current user data when authenticated', function (): void {
    $user = User::factory()->create();

    Sanctum::actingAs($user);

    $this->getJson('/api/v1/auth/me')
        ->assertStatus(200)
        ->assertJson(fn (AssertableJson $json) => $json
            ->has('data.id')
            ->has('data.name')
            ->has('data.email')
            ->has('data.roles')
            ->has('data.permissions')
            ->has('meta')
            ->has('message')
            ->where('data.id', $user->id)
            ->where('data.email', $user->email)
        );
});

test('me endpoint response does not expose password or remember_token', function (): void {
    $user = User::factory()->create();

    Sanctum::actingAs($user);

    $response = $this->getJson('/api/v1/auth/me');
    $response->assertStatus(200);
    $response->assertJsonMissing(['password']);
    $response->assertJsonMissing(['remember_token']);
});

test('me endpoint returns roles and permissions arrays', function (): void {
    $user = User::factory()->create();

    Sanctum::actingAs($user);

    $this->getJson('/api/v1/auth/me')
        ->assertStatus(200)
        ->assertJsonPath('data.roles', fn ($roles) => is_array($roles))
        ->assertJsonPath('data.permissions', fn ($perms) => is_array($perms));
});

test('me endpoint returns 401 when unauthenticated', function (): void {
    $this->getJson('/api/v1/auth/me')
        ->assertStatus(401)
        ->assertJson(fn (AssertableJson $json) => $json
            ->has('error.code')
            ->has('error.message')
            ->where('error.code', 'unauthenticated')
        );
});
