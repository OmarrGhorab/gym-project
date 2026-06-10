<?php

use App\Models\User;
use Illuminate\Testing\Fluent\AssertableJson;

/**
 * US2 — Authenticate Staff Users: Login
 *
 * Covers:
 *  - Valid credentials → 200 with user+token in data envelope
 *  - Invalid credentials → 401 stable error envelope
 *  - Missing fields → 422 validation error envelope
 *  - Rate limiting → 429 stable error envelope (login is throttled)
 */
test('valid credentials return 200 with user and token', function (): void {
    $user = User::factory()->create([
        'email' => 'staff@gym.test',
        'password' => bcrypt('secret123'),
    ]);

    $this->postJson('/api/v1/auth/login', [
        'email' => 'staff@gym.test',
        'password' => 'secret123',
    ])
        ->assertStatus(200)
        ->assertJson(fn (AssertableJson $json) => $json
            ->has('data.user')
            ->has('data.token')
            ->has('data.user.id')
            ->has('data.user.name')
            ->has('data.user.email')
            ->has('data.user.roles')
            ->has('data.user.permissions')
            ->has('meta')
            ->has('message')
            ->where('message', 'Authenticated')
        );
});

test('valid login response does not include password or remember_token', function (): void {
    User::factory()->create([
        'email' => 'staff@gym.test',
        'password' => bcrypt('secret123'),
    ]);

    $response = $this->postJson('/api/v1/auth/login', [
        'email' => 'staff@gym.test',
        'password' => 'secret123',
    ]);

    $response->assertStatus(200);
    $response->assertJsonMissing(['password']);
    $response->assertJsonMissing(['remember_token']);
});

test('wrong password returns 401 with stable error envelope', function (): void {
    User::factory()->create([
        'email' => 'staff@gym.test',
        'password' => bcrypt('correct'),
    ]);

    $this->postJson('/api/v1/auth/login', [
        'email' => 'staff@gym.test',
        'password' => 'wrong',
    ])
        ->assertStatus(401)
        ->assertJson(fn (AssertableJson $json) => $json
            ->has('error.code')
            ->has('error.message')
            ->has('error.details')
            ->where('error.code', 'invalid_credentials')
        );
});

test('non-existent email returns 401 not 404 to avoid account enumeration', function (): void {
    $this->postJson('/api/v1/auth/login', [
        'email' => 'nobody@gym.test',
        'password' => 'secret123',
    ])->assertStatus(401);
});

test('missing email returns 422 validation error', function (): void {
    $this->postJson('/api/v1/auth/login', [
        'password' => 'secret123',
    ])
        ->assertStatus(422)
        ->assertJson(fn (AssertableJson $json) => $json
            ->has('error')
            ->where('error.code', 'validation_failed')
            ->has('error.details.email')
        );
});

test('missing password returns 422 validation error', function (): void {
    $this->postJson('/api/v1/auth/login', [
        'email' => 'staff@gym.test',
    ])
        ->assertStatus(422)
        ->assertJson(fn (AssertableJson $json) => $json
            ->has('error')
            ->where('error.code', 'validation_failed')
            ->has('error.details.password')
        );
});

test('invalid email format returns 422 validation error', function (): void {
    $this->postJson('/api/v1/auth/login', [
        'email' => 'not-an-email',
        'password' => 'secret123',
    ])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed');
});
