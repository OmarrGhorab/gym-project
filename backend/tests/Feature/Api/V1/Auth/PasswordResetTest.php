<?php

use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Testing\Fluent\AssertableJson;

/**
 * US2 — Authenticate Staff Users: Password Reset
 *
 * Covers:
 *  - Valid forgot-password request returns 200 for any email (no enumeration)
 *  - Invalid email format returns 422
 *  - Valid reset token resets the password
 *  - Invalid/expired token returns 400
 *  - Validation errors on reset password fields return 422
 */
test('forgot password returns 200 for existing email', function (): void {
    User::factory()->create(['email' => 'reset@gym.test']);

    $this->postJson('/api/v1/auth/forgot-password', [
        'email' => 'reset@gym.test',
    ])
        ->assertStatus(200)
        ->assertJson(fn (AssertableJson $json) => $json
            ->has('data')
            ->has('meta')
            ->has('message')
        );
});

test('forgot password returns 200 for non-existent email to avoid enumeration', function (): void {
    $this->postJson('/api/v1/auth/forgot-password', [
        'email' => 'nobody@gym.test',
    ])
        ->assertStatus(200)
        ->assertJsonPath('message', 'If the email exists, a reset link has been sent.');
});

test('forgot password stores a reset token for existing user', function (): void {
    $user = User::factory()->create(['email' => 'reset@gym.test']);

    $this->postJson('/api/v1/auth/forgot-password', [
        'email' => 'reset@gym.test',
    ])->assertStatus(200);

    expect(DB::table('password_reset_tokens')->where('email', 'reset@gym.test')->exists())->toBeTrue();
});

test('forgot password missing email returns 422', function (): void {
    $this->postJson('/api/v1/auth/forgot-password', [])
        ->assertStatus(422)
        ->assertJson(fn (AssertableJson $json) => $json
            ->has('error')
            ->where('error.code', 'validation_failed')
            ->has('error.details.email')
        );
});

test('forgot password invalid email returns 422', function (): void {
    $this->postJson('/api/v1/auth/forgot-password', [
        'email' => 'not-an-email',
    ])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed');
});

test('reset password updates the password with valid token', function (): void {
    $user = User::factory()->create([
        'email' => 'reset@gym.test',
        'password' => Hash::make('old-password'),
    ]);

    $token = Password::broker()->createToken($user);

    $this->postJson('/api/v1/auth/reset-password', [
        'email' => 'reset@gym.test',
        'token' => $token,
        'password' => 'NewPassword123!',
        'password_confirmation' => 'NewPassword123!',
    ])
        ->assertStatus(200)
        ->assertJson(fn (AssertableJson $json) => $json
            ->has('data')
            ->has('meta')
            ->has('message')
            ->where('message', 'Password reset successfully.')
        );

    expect(Hash::check('NewPassword123!', $user->fresh()->password))->toBeTrue();
});

test('reset password deletes the token after success', function (): void {
    $user = User::factory()->create(['email' => 'reset@gym.test']);
    $token = Password::broker()->createToken($user);

    $this->postJson('/api/v1/auth/reset-password', [
        'email' => 'reset@gym.test',
        'token' => $token,
        'password' => 'NewPassword123!',
        'password_confirmation' => 'NewPassword123!',
    ])->assertStatus(200);

    expect(Password::broker()->tokenExists($user, $token))->toBeFalse();
});

test('reset password with invalid token returns 400', function (): void {
    User::factory()->create(['email' => 'reset@gym.test']);

    $this->postJson('/api/v1/auth/reset-password', [
        'email' => 'reset@gym.test',
        'token' => 'invalid-token',
        'password' => 'NewPassword123!',
        'password_confirmation' => 'NewPassword123!',
    ])
        ->assertStatus(400)
        ->assertJson(fn (AssertableJson $json) => $json
            ->has('error')
            ->where('error.code', 'password_reset_failed')
        );
});

test('reset password missing fields return 422', function (): void {
    $this->postJson('/api/v1/auth/reset-password', [])
        ->assertStatus(422)
        ->assertJson(fn (AssertableJson $json) => $json
            ->has('error')
            ->where('error.code', 'validation_failed')
            ->has('error.details.email')
            ->has('error.details.token')
            ->has('error.details.password')
        );
});

test('reset password password confirmation mismatch returns 422', function (): void {
    $this->postJson('/api/v1/auth/reset-password', [
        'email' => 'reset@gym.test',
        'token' => 'token',
        'password' => 'NewPassword123!',
        'password_confirmation' => 'Different123!',
    ])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed')
        ->assertJsonPath('error.details.password.0', 'The password field confirmation does not match.');
});
