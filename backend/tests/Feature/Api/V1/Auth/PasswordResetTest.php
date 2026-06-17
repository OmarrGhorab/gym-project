<?php

use App\Models\User;
use App\Notifications\Auth\SendPasswordResetOtp;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Illuminate\Testing\Fluent\AssertableJson;

/**
 * US2 — Authenticate Staff Users: Password Reset via OTP
 *
 * Covers:
 *  - Valid forgot-password request returns 200 for any email (no enumeration)
 *  - Invalid email format returns 422
 *  - Forgot password creates an OTP record for existing users and sends a notification
 *  - Valid OTP verification returns a reset token
 *  - Invalid/expired OTP verification returns 400
 *  - Valid reset token resets the password
 *  - Invalid/expired token returns 400
 *  - Validation errors on all endpoints return 422
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
        ->assertJsonPath('message', 'If the email exists, a password reset code has been sent.');
});

test('forgot password stores an otp record and sends a notification for existing user', function (): void {
    $user = User::factory()->create(['email' => 'reset@gym.test']);

    Notification::fake();

    $this->postJson('/api/v1/auth/forgot-password', [
        'email' => 'reset@gym.test',
    ])->assertStatus(200);

    $record = DB::table('password_reset_otps')->where('email', 'reset@gym.test')->first();
    expect($record)->not->toBeNull();

    Notification::assertSentTo(
        $user,
        SendPasswordResetOtp::class,
        function (SendPasswordResetOtp $notification) use ($record): bool {
            return Hash::check($notification->otp, $record->otp_hash);
        }
    );
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

test('verify otp returns a reset token for a valid otp', function (): void {
    User::factory()->create(['email' => 'reset@gym.test']);
    $otp = '123456';

    DB::table('password_reset_otps')->insert([
        'email' => 'reset@gym.test',
        'otp_hash' => Hash::make($otp),
        'expires_at' => now()->addMinutes(15),
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $this->postJson('/api/v1/auth/verify-otp', [
        'email' => 'reset@gym.test',
        'otp' => $otp,
    ])
        ->assertStatus(200)
        ->assertJson(fn (AssertableJson $json) => $json
            ->has('data.reset_token')
            ->has('meta')
            ->where('message', 'Code verified. You may now reset your password.')
        );

    expect(DB::table('password_reset_otps')->where('email', 'reset@gym.test')->exists())->toBeFalse();
});

test('verify otp with invalid otp returns 400', function (): void {
    User::factory()->create(['email' => 'reset@gym.test']);

    DB::table('password_reset_otps')->insert([
        'email' => 'reset@gym.test',
        'otp_hash' => Hash::make('123456'),
        'expires_at' => now()->addMinutes(15),
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $this->postJson('/api/v1/auth/verify-otp', [
        'email' => 'reset@gym.test',
        'otp' => '000000',
    ])
        ->assertStatus(400)
        ->assertJson(fn (AssertableJson $json) => $json
            ->has('error')
            ->where('error.code', 'invalid_otp')
        );
});

test('verify otp with expired otp returns 400', function (): void {
    User::factory()->create(['email' => 'reset@gym.test']);

    DB::table('password_reset_otps')->insert([
        'email' => 'reset@gym.test',
        'otp_hash' => Hash::make('123456'),
        'expires_at' => now()->subMinute(),
        'created_at' => now()->subMinutes(16),
        'updated_at' => now()->subMinutes(16),
    ]);

    $this->postJson('/api/v1/auth/verify-otp', [
        'email' => 'reset@gym.test',
        'otp' => '123456',
    ])
        ->assertStatus(400)
        ->assertJsonPath('error.code', 'invalid_otp');
});

test('verify otp missing fields return 422', function (): void {
    $this->postJson('/api/v1/auth/verify-otp', [])
        ->assertStatus(422)
        ->assertJson(fn (AssertableJson $json) => $json
            ->has('error')
            ->where('error.code', 'validation_failed')
            ->has('error.details.email')
            ->has('error.details.otp')
        );
});

test('verify otp invalid otp format returns 422', function (): void {
    $this->postJson('/api/v1/auth/verify-otp', [
        'email' => 'reset@gym.test',
        'otp' => 'abc',
    ])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed')
        ->assertJsonPath('error.details.otp.0', 'The otp field must be 6 digits.');
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
