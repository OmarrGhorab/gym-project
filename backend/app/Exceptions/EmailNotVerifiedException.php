<?php

namespace App\Exceptions;

use Illuminate\Auth\AuthenticationException;

/**
 * Thrown when a user with valid credentials tries to log in before
 * verifying their email address.
 */
final class EmailNotVerifiedException extends AuthenticationException
{
    public function __construct()
    {
        parent::__construct('Email address not verified.');
    }
}
