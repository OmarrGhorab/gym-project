<?php

namespace App\Actions\Auth;

use Illuminate\Support\Facades\Password;

/**
 * Sends a password reset link to the given email address.
 *
 * Receives a typed, already-validated email — never touches the HTTP request.
 * Callable identically from controllers, jobs, and tests.
 *
 * Returns a Password broker status string (e.g. PASSWORD_RESET_LINK_SENT).
 */
final class SendPasswordResetLink
{
    public function handle(string $email): string
    {
        return Password::sendResetLink([
            'email' => $email,
        ]);
    }
}
