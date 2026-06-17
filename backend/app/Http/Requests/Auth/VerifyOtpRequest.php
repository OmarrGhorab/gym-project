<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Validates the OTP verification payload before the controller or action sees it.
 */
final class VerifyOtpRequest extends FormRequest
{
    /**
     * OTP verification is a public endpoint; any caller with an OTP may attempt it.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Validation rules for verifying a password reset OTP.
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
