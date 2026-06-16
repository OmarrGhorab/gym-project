<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;

/**
 * Validates the registration payload before the controller or action sees it.
 *
 * Authorization is always true for the public registration endpoint — the
 * actual uniqueness check happens via the unique database rule and the
 * RegisterUser action.
 */
final class RegisterRequest extends FormRequest
{
    /**
     * Registration is a public endpoint; any caller may attempt it.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Validation rules for registering a new staff user.
     *
     * @return array<string, list<string|Password>>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'confirmed', Password::defaults()],
        ];
    }
}
