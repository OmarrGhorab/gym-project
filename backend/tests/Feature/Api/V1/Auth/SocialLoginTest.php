<?php

use App\Models\User;
use Illuminate\Testing\Fluent\AssertableJson;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\User as SocialiteUser;

/**
 * US2 — Authenticate Staff Users: Social Login
 *
 * Covers:
 *  - Supported provider redirect returns a redirect response
 *  - Unsupported provider redirect returns 404
 *  - OAuth callback creates a new user + social account + token
 *  - OAuth callback links an existing user with matching email
 *  - OAuth callback without email returns 422 validation error
 */
function mockSocialiteDriver(string $provider, SocialiteUser $user): void
{
    $driver = Mockery::mock('Laravel\Socialite\Contracts\Provider');
    $driver->shouldReceive('stateless')->andReturnSelf();
    $driver->shouldReceive('user')->andReturn($user);

    Socialite::shouldReceive('driver')
        ->with($provider)
        ->andReturn($driver);
}

function makeSocialiteUser(array $overrides = []): SocialiteUser
{
    $defaults = [
        'id' => 'google-123',
        'email' => 'social@gym.test',
        'name' => 'Social User',
        'nickname' => 'socialuser',
        'avatar' => 'https://example.com/avatar.png',
        'token' => 'access-token',
        'refreshToken' => 'refresh-token',
        'expiresIn' => 3600,
    ];

    $values = array_merge($defaults, $overrides);

    $user = new SocialiteUser;
    $user->id = $values['id'];
    $user->email = $values['email'];
    $user->name = $values['name'];
    $user->nickname = $values['nickname'];
    $user->avatar = $values['avatar'];
    $user->token = $values['token'];
    $user->refreshToken = $values['refreshToken'];
    $user->expiresIn = $values['expiresIn'];

    return $user;
}

test('supported provider redirect returns a redirect response', function (): void {
    $driver = Mockery::mock('Laravel\Socialite\Contracts\Provider');
    $driver->shouldReceive('stateless')->andReturnSelf();
    $driver->shouldReceive('redirect')->andReturn(redirect('https://accounts.google.com/o/oauth2/auth'));

    Socialite::shouldReceive('driver')
        ->with('google')
        ->andReturn($driver);

    $this->getJson('/api/v1/auth/google/redirect')
        ->assertStatus(302)
        ->assertRedirect('https://accounts.google.com/o/oauth2/auth');
});

test('unsupported provider redirect returns 404', function (): void {
    $this->getJson('/api/v1/auth/twitter/redirect')
        ->assertStatus(404)
        ->assertJson(fn (AssertableJson $json) => $json
            ->has('error')
            ->where('error.code', 'not_found')
        );
});

test('social callback creates a new user and returns a token', function (): void {
    $socialiteUser = makeSocialiteUser([
        'id' => 'google-123',
        'email' => 'social@gym.test',
        'name' => 'Social User',
    ]);

    mockSocialiteDriver('google', $socialiteUser);

    $this->getJson('/api/v1/auth/google/callback')
        ->assertStatus(200)
        ->assertJson(fn (AssertableJson $json) => $json
            ->has('data.user')
            ->has('data.token')
            ->has('meta')
            ->has('message')
            ->where('data.user.email', 'social@gym.test')
            ->where('data.user.name', 'Social User')
            ->where('message', 'Authenticated via Google')
        );

    $user = User::where('email', 'social@gym.test')->first();
    expect($user)->not->toBeNull();
    expect($user->password)->toBeNull();
    expect($user->socialAccounts()->where('provider', 'google')->exists())->toBeTrue();
});

test('social callback links existing user with matching email', function (): void {
    $existingUser = User::factory()->create([
        'email' => 'existing@gym.test',
        'password' => bcrypt('secret'),
    ]);

    $socialiteUser = makeSocialiteUser([
        'id' => 'google-456',
        'email' => 'existing@gym.test',
        'name' => 'Existing Social',
    ]);

    mockSocialiteDriver('google', $socialiteUser);

    $this->getJson('/api/v1/auth/google/callback')
        ->assertStatus(200)
        ->assertJson(fn (AssertableJson $json) => $json
            ->has('data.user')
            ->has('data.token')
            ->has('meta')
            ->has('message')
            ->where('data.user.id', $existingUser->id)
            ->where('data.user.email', 'existing@gym.test')
        );

    expect($existingUser->fresh()->socialAccounts()->where('provider', 'google')->exists())->toBeTrue();
});

test('social callback without email returns 422 validation error', function (): void {
    $socialiteUser = makeSocialiteUser(['email' => null]);

    mockSocialiteDriver('google', $socialiteUser);

    $this->getJson('/api/v1/auth/google/callback')
        ->assertStatus(422)
        ->assertJson(fn (AssertableJson $json) => $json
            ->has('error')
            ->where('error.code', 'validation_failed')
            ->has('error.details.email')
        );
});

test('social callback response does not include password or remember_token', function (): void {
    $socialiteUser = makeSocialiteUser([
        'id' => 'google-789',
        'email' => 'secure@gym.test',
    ]);

    mockSocialiteDriver('google', $socialiteUser);

    $response = $this->getJson('/api/v1/auth/google/callback');

    $response->assertStatus(200);
    $response->assertJsonMissing(['password']);
    $response->assertJsonMissing(['remember_token']);
});
