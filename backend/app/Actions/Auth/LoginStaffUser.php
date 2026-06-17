<?php

namespace App\Actions\Auth;

use App\Exceptions\EmailNotVerifiedException;
use App\Exceptions\InvalidCredentialsException;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\Hash;

/**
 * Authenticates a staff user by email/password and issues a Sanctum token.
 *
 * Receives typed, already-validated inputs — never touches the HTTP request.
 * Callable identically from controllers, jobs, and tests.
 *
 * Returns an array with the authenticated User and the plain-text token.
 * The plain-text token is returned exactly once (Sanctum never stores it
 * in recoverable form).
 *
 * Throws AuthenticationException on invalid credentials — the error
 * envelope shape (401 invalid_credentials) is rendered by bootstrap/app.php.
 * We deliberately give the same response whether the email doesn't exist or
 * the password is wrong, to avoid account enumeration (FR-007).
 */
final class LoginStaffUser
{
    /**
     * @return array{ user: User, token: string }
     *
     * @throws AuthenticationException
     */
    public function handle(string $email, string $password, bool $remember = false): array
    {
        $user = User::where('email', $email)->first();

        if (! $user || ! Hash::check($password, $user->password)) {
            // Same response for "user not found" and "wrong password" to
            // prevent account enumeration attacks.
            throw new InvalidCredentialsException;
        }

        if ($user->email_verified_at === null) {
            throw new EmailNotVerifiedException;
        }

        $expiresAt = $remember ? Carbon::now()->addDays(30) : null;

        $token = $user->createToken('staff-token', ['*'], $expiresAt)->plainTextToken;

        return [
            'user' => $user,
            'token' => $token,
        ];
    }
}
