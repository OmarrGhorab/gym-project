<?php

namespace App\Actions\Auth;

use App\Models\User;
use App\Support\Otp;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Password;

/**
 * Verifies a password-reset OTP and issues a short-lived reset token.
 *
 * Returns an array with a boolean `valid` flag and, on success, a `token`
 * that can be consumed by the standard password reset broker.
 */
final class VerifyPasswordResetOtp
{
    /**
     * @return array{ valid: bool, token: string|null }
     */
    public function handle(string $email, string $otp): array
    {
        $record = DB::table('password_reset_otps')
            ->where('email', $email)
            ->where('expires_at', '>', now())
            ->latest('created_at')
            ->first();

        if ($record === null) {
            return [
                'valid' => false,
                'token' => null,
            ];
        }

        if ((int) $record->attempts >= 5) {
            DB::table('password_reset_otps')->where('id', $record->id)->delete();

            return [
                'valid' => false,
                'token' => null,
            ];
        }

        if (! Otp::verify($otp, $record->otp_hash)) {
            DB::table('password_reset_otps')
                ->where('id', $record->id)
                ->increment('attempts');

            return [
                'valid' => false,
                'token' => null,
            ];
        }

        $user = User::where('email', $email)->first();

        if ($user === null) {
            return [
                'valid' => false,
                'token' => null,
            ];
        }

        DB::table('password_reset_otps')->where('id', $record->id)->delete();

        $token = Password::broker()->createToken($user);

        return [
            'valid' => true,
            'token' => $token,
        ];
    }
}
