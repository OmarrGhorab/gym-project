<?php

use App\Models\User;
use Illuminate\Testing\Fluent\AssertableJson;

/**
 * US2 — Authenticate Staff Users: Registration
 *
 * Covers:
 *  - Valid registration → 200 with user+token in data envelope
 *  - Missing/invalid fields → 422 validation error envelope
 *  - Duplicate email → 422 validation error envelope
 *  - Registration response does not include password or remember_token
 */
test('valid registration returns 200 with user and token', function (): void {
    $this->postJson('/api/v1/auth/register', [
        'name' => 'Test User',
        'email' => 'new@gym.test',
        'password' => 'Secret123!',
        'password_confirmation' => 'Secret123!',
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
            ->where('message', 'Registered')
            ->where('data.user.email', 'new@gym.test')
            ->where('data.user.name', 'Test User')
        );

    expect(User::where('email', 'new@gym.test')->exists())->toBeTrue();
});

test('registration response does not include password or remember_token', function (): void {
    $response = $this->postJson('/api/v1/auth/register', [
        'name' => 'Test User',
        'email' => 'new@gym.test',
        'password' => 'Secret123!',
        'password_confirmation' => 'Secret123!',
    ]);

    $response->assertStatus(200);
    $response->assertJsonMissing(['password']);
    $response->assertJsonMissing(['remember_token']);
});

test('missing name returns 422 validation error', function (): void {
    $this->postJson('/api/v1/auth/register', [
        'email' => 'new@gym.test',
        'password' => 'Secret123!',
        'password_confirmation' => 'Secret123!',
    ])
        ->assertStatus(422)
        ->assertJson(fn (AssertableJson $json) => $json
            ->has('error')
            ->where('error.code', 'validation_failed')
            ->has('error.details.name')
        );
});

test('missing email returns 422 validation error', function (): void {
    $this->postJson('/api/v1/auth/register', [
        'name' => 'Test User',
        'password' => 'Secret123!',
        'password_confirmation' => 'Secret123!',
    ])
        ->assertStatus(422)
        ->assertJson(fn (AssertableJson $json) => $json
            ->has('error')
            ->where('error.code', 'validation_failed')
            ->has('error.details.email')
        );
});

test('invalid email format returns 422 validation error', function (): void {
    $this->postJson('/api/v1/auth/register', [
        'name' => 'Test User',
        'email' => 'not-an-email',
        'password' => 'Secret123!',
        'password_confirmation' => 'Secret123!',
    ])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed')
        ->assertJsonPath('error.details.email.0', 'The email field must be a valid email address.');
});

test('password confirmation mismatch returns 422 validation error', function (): void {
    $this->postJson('/api/v1/auth/register', [
        'name' => 'Test User',
        'email' => 'new@gym.test',
        'password' => 'Secret123!',
        'password_confirmation' => 'Different123!',
    ])
        ->assertStatus(422)
        ->assertJson(fn (AssertableJson $json) => $json
            ->has('error')
            ->where('error.code', 'validation_failed')
            ->has('error.details.password')
        );
});

test('duplicate email returns 422 validation error', function (): void {
    User::factory()->create(['email' => 'existing@gym.test']);

    $this->postJson('/api/v1/auth/register', [
        'name' => 'Test User',
        'email' => 'existing@gym.test',
        'password' => 'Secret123!',
        'password_confirmation' => 'Secret123!',
    ])
        ->assertStatus(422)
        ->assertJson(fn (AssertableJson $json) => $json
            ->has('error')
            ->where('error.code', 'validation_failed')
            ->has('error.details.email')
        );
});
