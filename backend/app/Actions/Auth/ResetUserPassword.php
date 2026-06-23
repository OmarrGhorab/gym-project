<?php

namespace App\Actions\Auth;

use App\Models\User;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;

/**
 * Resets a user's password using a valid reset token.
 *
 * Receives typed, already-validated inputs — never touches the HTTP request.
 * Callable identically from controllers, jobs, and tests.
 *
 * Returns a Password broker status string (e.g. PASSWORD_RESET_SUCCESS).
 */
final class ResetUserPassword
{
    public function handle(string $email, string $token, string $password): string
    {
        return Password::reset(
            [
                'email' => $email,
                'token' => $token,
                'password' => $password,
                'password_confirmation' => $password,
            ],
            function (User $user, string $password): void {
                $user->forceFill([
                    'password' => Hash::make($password),
                ])->save();

                $user->tokens()->delete();

                event(new PasswordReset($user));
            }
        );
    }
}
