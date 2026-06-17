<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Validates the resend-verification payload before the controller sees it.
 */
final class ResendVerificationRequest extends FormRequest
{
    /**
     * Resend verification is a public endpoint; any caller may attempt it.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Validation rules for resending the verification OTP.
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
