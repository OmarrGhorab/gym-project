<?php

use App\Models\User;
use App\Notifications\Auth\SendEmailVerificationOtp;
use App\Support\Otp;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Testing\Fluent\AssertableJson;

/**
 * US2 — Authenticate Staff Users: Registration
 *
 * Covers:
 *  - Valid registration → 200 with user in data envelope and OTP sent
 *  - Missing/invalid fields → 422 validation error envelope
 *  - Duplicate email → 422 validation error envelope
 *  - Registration response does not include password or remember_token
 *  - Login is blocked until email is verified
 *  - Valid verification OTP issues a token and marks email verified
 *  - Invalid/expired verification OTP returns 400
 */
test('valid registration returns 200 with user and sends verification otp', function (): void {
    Notification::fake();

    $this->postJson('/api/v1/auth/register', [
        'name' => 'Test User',
        'email' => 'new@gym.test',
        'password' => 'Secret123!',
        'password_confirmation' => 'Secret123!',
    ])
        ->assertStatus(200)
        ->assertJson(fn (AssertableJson $json) => $json
            ->has('data.user')
            ->has('data.user.id')
            ->has('data.user.name')
            ->has('data.user.email')
            ->has('data.user.roles')
            ->has('data.user.permissions')
            ->has('meta')
            ->has('message')
            ->where('message', 'Registered. Please check your email for a verification code.')
            ->where('data.user.email', 'new@gym.test')
            ->where('data.user.name', 'Test User')
        );

    $user = User::where('email', 'new@gym.test')->first();
    expect($user)->not->toBeNull();
    expect($user->email_verified_at)->toBeNull();

    Notification::assertSentTo(
        $user,
        SendEmailVerificationOtp::class,
        function (SendEmailVerificationOtp $notification): bool {
            $record = DB::table('email_verification_otps')->where('email', 'new@gym.test')->first();

            return $record !== null && Otp::verify($notification->otp, $record->otp_hash);
        }
    );

    expect(DB::table('email_verification_otps')->where('email', 'new@gym.test')->exists())->toBeTrue();
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

test('login is blocked before email verification', function (): void {
    User::factory()->create([
        'email' => 'unverified@gym.test',
        'password' => Hash::make('Secret123!'),
        'email_verified_at' => null,
    ]);

    $this->postJson('/api/v1/auth/login', [
        'email' => 'unverified@gym.test',
        'password' => 'Secret123!',
    ])
        ->assertStatus(403)
        ->assertJson(fn (AssertableJson $json) => $json
            ->has('error')
            ->where('error.code', 'email_not_verified')
        );
});

test('verify email returns token for valid otp', function (): void {
    $user = User::factory()->unverified()->create([
        'email' => 'new@gym.test',
        'password' => Hash::make('Secret123!'),
    ]);

    $otp = '123456';
    DB::table('email_verification_otps')->insert([
        'email' => 'new@gym.test',
        'otp_hash' => Otp::hash($otp),
        'expires_at' => now()->addMinutes(15),
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $this->postJson('/api/v1/auth/verify-email', [
        'email' => 'new@gym.test',
        'otp' => $otp,
    ])
        ->assertStatus(200)
        ->assertJson(fn (AssertableJson $json) => $json
            ->has('data.user')
            ->has('data.token')
            ->has('meta')
            ->has('message')
        );

    expect($user->fresh()->email_verified_at)->not->toBeNull();
    expect(DB::table('email_verification_otps')->where('email', 'new@gym.test')->exists())->toBeFalse();
});

test('verify email with invalid otp returns 400', function (): void {
    User::factory()->unverified()->create(['email' => 'new@gym.test']);

    DB::table('email_verification_otps')->insert([
        'email' => 'new@gym.test',
        'otp_hash' => Otp::hash('123456'),
        'expires_at' => now()->addMinutes(15),
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $this->postJson('/api/v1/auth/verify-email', [
        'email' => 'new@gym.test',
        'otp' => '000000',
    ])
        ->assertStatus(400)
        ->assertJson(fn (AssertableJson $json) => $json
            ->has('error')
            ->where('error.code', 'invalid_otp')
        );
});

test('verify email with expired otp returns 400', function (): void {
    User::factory()->unverified()->create(['email' => 'new@gym.test']);

    DB::table('email_verification_otps')->insert([
        'email' => 'new@gym.test',
        'otp_hash' => Otp::hash('123456'),
        'expires_at' => now()->subMinute(),
        'created_at' => now()->subMinutes(16),
        'updated_at' => now()->subMinutes(16),
    ]);

    $this->postJson('/api/v1/auth/verify-email', [
        'email' => 'new@gym.test',
        'otp' => '123456',
    ])
        ->assertStatus(400)
        ->assertJsonPath('error.code', 'invalid_otp');
});

test('resend verification sends otp for unverified user', function (): void {
    $user = User::factory()->unverified()->create(['email' => 'new@gym.test']);

    Notification::fake();

    $this->postJson('/api/v1/auth/resend-verification', [
        'email' => 'new@gym.test',
    ])
        ->assertStatus(200)
        ->assertJsonPath(
            'message',
            'If the account exists and is unverified, a new code has been sent.'
        );

    Notification::assertSentTo(
        $user,
        SendEmailVerificationOtp::class
    );
});

test('resend verification silently does nothing for verified user', function (): void {
    User::factory()->create(['email' => 'verified@gym.test']);

    Notification::fake();

    $this->postJson('/api/v1/auth/resend-verification', [
        'email' => 'verified@gym.test',
    ])->assertStatus(200);

    Notification::assertNothingSent();
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
