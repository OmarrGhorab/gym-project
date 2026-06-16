<?php

namespace App\Actions\Auth;

use App\Models\User;
use Illuminate\Support\Facades\Hash;

/**
 * Registers a new staff user and issues a Sanctum token.
 *
 * Receives typed, already-validated inputs — never touches the HTTP request.
 * Callable identically from controllers, jobs, and tests.
 *
 * Returns an array with the created User and the plain-text token.
 */
final class RegisterUser
{
    /**
     * @return array{ user: User, token: string }
     */
    public function handle(string $name, string $email, string $password): array
    {
        $user = User::create([
            'name' => $name,
            'email' => $email,
            'password' => Hash::make($password),
        ]);

        $token = $user->createToken('staff-token')->plainTextToken;

        return [
            'user' => $user,
            'token' => $token,
        ];
    }
}
