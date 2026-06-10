<?php

use App\Models\User;
use Illuminate\Testing\Fluent\AssertableJson;
use Laravel\Sanctum\Sanctum;

/**
 * US2 — Authenticate Staff Users: Logout
 *
 * Covers:
 *  - Authenticated logout → 200 with null data, token revoked
 *  - Revoked token can no longer access protected endpoints
 *  - Unauthenticated logout attempt → 401 stable error envelope
 */
test('authenticated user can sign out and receives 200', function (): void {
    $user = User::factory()->create();

    Sanctum::actingAs($user);

    $this->postJson('/api/v1/auth/logout')
        ->assertStatus(200)
        ->assertJson(fn (AssertableJson $json) => $json
            ->has('data')
            ->has('meta')
            ->has('message')
            ->where('message', 'Signed out')
        );
});

test('token is revoked after logout so protected endpoints return 401', function (): void {
    // Create a real token (not Sanctum::actingAs) so we can test revocation.
    $user = User::factory()->create(['password' => bcrypt('secret')]);
    $token = $user->createToken('test-token')->plainTextToken;

    // Verify the token works before logout.
    $this->withToken($token)
        ->getJson('/api/v1/auth/me')
        ->assertStatus(200);

    // Reset the auth guard cache between requests so Sanctum re-resolves
    // the token from the database on the next request.
    $this->app['auth']->forgetGuards();

    // Logout revokes the current token.
    $this->withToken($token)
        ->postJson('/api/v1/auth/logout')
        ->assertStatus(200);

    // Reset again after logout before making the verification request.
    $this->app['auth']->forgetGuards();

    // The same token must no longer work.
    $this->withToken($token)
        ->getJson('/api/v1/auth/me')
        ->assertStatus(401);
});

test('logout returns 401 when called without authentication', function (): void {
    $this->postJson('/api/v1/auth/logout')
        ->assertStatus(401)
        ->assertJson(fn (AssertableJson $json) => $json
            ->where('error.code', 'unauthenticated')
        );
});
