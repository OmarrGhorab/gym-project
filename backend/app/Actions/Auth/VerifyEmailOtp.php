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
        $result = ['valid' => false, 'user' => null, 'token' => null];

        DB::transaction(function () use ($email, $otp, &$result): void {
            $record = DB::table('email_verification_otps')
                ->where('email', $email)
                ->where('expires_at', '>', now())
                ->latest('created_at')
                ->lockForUpdate()
                ->first();

            if ($record === null) {
                return;
            }

            if ((int) $record->attempts >= 5) {
                DB::table('email_verification_otps')->where('id', $record->id)->delete();

                return;
            }

            if (! Otp::verify($otp, $record->otp_hash)) {
                DB::table('email_verification_otps')
                    ->where('id', $record->id)
                    ->increment('attempts');

                return;
            }

            $user = User::where('email', $email)->first();

            if ($user === null) {
                return;
            }

            DB::table('email_verification_otps')->where('id', $record->id)->delete();

            $user->forceFill([
                'email_verified_at' => now(),
            ])->save();

            $token = $user->createToken('staff-token')->plainTextToken;

            $result = [
                'valid' => true,
                'user' => $user,
                'token' => $token,
            ];
        });

        return $result;
    }
}
