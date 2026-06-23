<?php

namespace App\Actions\Auth;

use App\Models\User;
use App\Support\Otp;
use Illuminate\Support\Facades\DB;

/**
 * Verifies an email-verification OTP and issues a Sanctum token.
 *
 * On success, marks the user's email as verified, deletes the OTP, and
 * returns the authenticated user plus a plain-text token.
 */
final class VerifyEmailOtp
{
    /**
     * @return array{ valid: bool, user: User|null, token: string|null }
     */
    public function handle(string $email, string $otp): array
    {
        $record = DB::table('email_verification_otps')
            ->where('email', $email)
            ->where('expires_at', '>', now())
            ->latest('created_at')
            ->first();

        if ($record === null) {
            return [
                'valid' => false,
                'user' => null,
                'token' => null,
            ];
        }

        if ((int) $record->attempts >= 5) {
            DB::table('email_verification_otps')->where('id', $record->id)->delete();

            return [
                'valid' => false,
                'user' => null,
                'token' => null,
            ];
        }

        if (! Otp::verify($otp, $record->otp_hash)) {
            DB::table('email_verification_otps')
                ->where('id', $record->id)
                ->increment('attempts');

            return [
                'valid' => false,
                'user' => null,
                'token' => null,
            ];
        }

        $user = User::where('email', $email)->first();

        if ($user === null) {
            return [
                'valid' => false,
                'user' => null,
                'token' => null,
            ];
        }

        DB::transaction(function () use ($record, $user): void {
            DB::table('email_verification_otps')->where('id', $record->id)->delete();

            $user->forceFill([
                'email_verified_at' => now(),
            ])->save();
        });

        $token = $user->createToken('staff-token')->plainTextToken;

        return [
            'valid' => true,
            'user' => $user,
            'token' => $token,
        ];
    }
}
