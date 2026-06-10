<?php

namespace App\Actions\Auth;

use App\Models\User;

/**
 * Revokes the current Sanctum token for the given user.
 *
 * Receives the authenticated User — never touches the HTTP request.
 * Callable from controllers, jobs, and tests identically.
 *
 * Only the current token is revoked; other active tokens (e.g. from
 * another device) are not affected. This matches the logout endpoint
 * contract (POST /api/v1/auth/logout).
 */
final class LogoutStaffUser
{
    public function handle(User $user): void
    {
        // currentAccessToken() returns the token that authenticated the
        // current request. We delete only this token so other sessions
        // remain active.
        $user->currentAccessToken()->delete();
    }
}
