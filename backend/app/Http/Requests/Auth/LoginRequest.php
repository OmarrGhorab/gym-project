<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Validates the login payload before the controller or action sees it.
 *
 * Authorization is always true for the public login endpoint — the actual
 * credential check happens inside LoginStaffUser, not here.
 */
final class LoginRequest extends FormRequest
{
    /**
     * Login is a public endpoint; any caller may attempt it.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Validation rules for login credentials.
     *
     * @return array<string, list<string>>
     */
    public function rules(): array
    {
        return [
            'email' => ['required', 'string', 'email'],
            'password' => ['required', 'string'],
            'remember' => ['sometimes', 'boolean'],
        ];
    }
}
