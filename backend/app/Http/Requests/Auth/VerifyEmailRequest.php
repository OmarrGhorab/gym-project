<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Validates the email verification OTP payload before the controller sees it.
 */
final class VerifyEmailRequest extends FormRequest
{
    /**
     * Email verification is a public endpoint; any caller with an OTP may attempt it.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Validation rules for verifying an email verification OTP.
     *
     * @return array<string, list<string>>
     */
    public function rules(): array
    {
        return [
            'email' => ['required', 'string', 'email'],
            'otp' => ['required', 'string', 'digits:6'],
        ];
    }
}
