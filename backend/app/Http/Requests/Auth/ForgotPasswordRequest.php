<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Validates the forgot-password payload before the controller or action sees it.
 */
final class ForgotPasswordRequest extends FormRequest
{
    /**
     * Forgot password is a public endpoint; any caller may attempt it.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Validation rules for requesting a password reset link.
     *
     * @return array<string, list<string>>
     */
    public function rules(): array
    {
        return [
            'email' => ['required', 'string', 'email'],
        ];
    }
}
