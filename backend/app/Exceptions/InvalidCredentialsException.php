<?php

namespace App\Exceptions;

use Illuminate\Auth\AuthenticationException;

/**
 * Thrown when login credentials are wrong.
 *
 * Extends AuthenticationException so the existing exception renderer in
 * bootstrap/app.php handles it as 401, but we render a distinct
 * `invalid_credentials` code rather than `unauthenticated` so clients
 * can distinguish "bad credentials at login" from "token expired/missing".
 */
final class InvalidCredentialsException extends AuthenticationException
{
    public function __construct()
    {
        // Deliberately vague: same message for unknown email and wrong
        // password to prevent account enumeration (FR-007, Constitution V).
        parent::__construct('Invalid credentials.');
    }
}
