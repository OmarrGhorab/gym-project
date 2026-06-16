<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;

/**
 * Validates the reset-password payload before the controller or action sees it.
 */
final class ResetPasswordRequest extends FormRequest
{
    /**
     * Reset password is a public endpoint; any caller with a valid token may attempt it.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Validation rules for resetting a password.
     *
     * @return array<string, list<string|Password>>
     */
    public function rules(): array
    {
        return [
            'email' => ['required', 'string', 'email'],
            'token' => ['required', 'string'],
            'password' => ['required', 'string', 'confirmed', Password::defaults()],
        ];
    }
}
