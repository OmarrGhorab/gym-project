<?php

namespace App\Actions\Auth;

use App\Models\SocialAccount;
use App\Models\User;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Facades\DB;
use Laravel\Socialite\Contracts\User as SocialiteUser;

/**
 * Handles OAuth login / registration for a supported social provider.
 *
 * Receives a provider identifier and the Socialite user abstraction — never
 * touches the HTTP request. Callable identically from controllers, jobs, and
 * tests.
 *
 * Matching strategy:
 *   1. Find an existing social account by (provider, provider_id).
 *   2. If found, update token metadata and return that user.
 *   3. If not found but the email matches an existing user, link the social
 *      account to that user.
 *   4. Otherwise create a new user without a password and attach the social
 *      account.
 *
 * Returns an array with the User and the plain-text Sanctum token.
 */
final class HandleSocialLogin
{
    /**
     * @return array{ user: User, token: string }
     */
    public function handle(string $provider, SocialiteUser $socialiteUser): array
    {
        $email = $socialiteUser->getEmail();

        if (empty($email)) {
            throw new ModelNotFoundException('Social account did not provide an email address.');
        }

        return DB::transaction(function () use ($provider, $socialiteUser, $email): array {
            $socialAccount = SocialAccount::with('user')
                ->where('provider', $provider)
                ->where('provider_id', $socialiteUser->getId())
                ->first();

            if ($socialAccount) {
                $user = $socialAccount->user;
                $this->updateSocialAccount($socialAccount, $socialiteUser);
            } else {
                $user = User::where('email', $email)->first();

                if (! $user) {
                    $user = User::create([
                        'name' => $socialiteUser->getName() ?? $socialiteUser->getNickname() ?? explode('@', $email)[0],
                        'email' => $email,
                        'password' => null,
                    ]);
                }

                if ($user->email_verified_at === null) {
                    $user->forceFill(['email_verified_at' => now()])->save();
                }

                $socialAccount = $this->createSocialAccount($user, $provider, $socialiteUser);
            }

            $token = $user->createToken('social-token')->plainTextToken;

            return [
                'user' => $user,
                'token' => $token,
            ];
        });
    }

    private function updateSocialAccount(SocialAccount $account, SocialiteUser $socialiteUser): void
    {
        $account->update([
            'nickname' => $socialiteUser->getNickname(),
            'avatar' => $socialiteUser->getAvatar(),
            'access_token' => $socialiteUser->token,
            'refresh_token' => $socialiteUser->refreshToken,
            'token_expires_at' => $socialiteUser->expiresIn ? now()->addSeconds($socialiteUser->expiresIn) : null,
        ]);
    }

    private function createSocialAccount(User $user, string $provider, SocialiteUser $socialiteUser): SocialAccount
    {
        return $user->socialAccounts()->create([
            'provider' => $provider,
            'provider_id' => $socialiteUser->getId(),
            'nickname' => $socialiteUser->getNickname(),
            'avatar' => $socialiteUser->getAvatar(),
            'access_token' => $socialiteUser->token,
            'refresh_token' => $socialiteUser->refreshToken,
            'token_expires_at' => $socialiteUser->expiresIn ? now()->addSeconds($socialiteUser->expiresIn) : null,
        ]);
    }
}
