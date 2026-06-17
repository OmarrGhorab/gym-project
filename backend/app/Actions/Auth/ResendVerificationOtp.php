<?php

namespace App\Actions\Auth;

use App\Models\User;
use App\Notifications\Auth\SendEmailVerificationOtp;
use App\Support\Otp;
use Illuminate\Support\Facades\DB;

/**
 * Resends the email verification OTP for an unverified user.
 *
 * Silently does nothing if the user does not exist or is already verified,
 * to avoid account enumeration.
 */
final class ResendVerificationOtp
{
    public function handle(string $email): void
    {
        $user = User::where('email', $email)
            ->whereNull('email_verified_at')
            ->first();

        if ($user === null) {
            return;
        }

        $otp = Otp::generate();

        DB::transaction(function () use ($email, $otp): void {
            DB::table('email_verification_otps')
                ->where('email', $email)
                ->delete();

            DB::table('email_verification_otps')->insert([
                'email' => $email,
                'otp_hash' => Otp::hash($otp),
                'expires_at' => Otp::expiry(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        });

        $user->notify(new SendEmailVerificationOtp($otp));
    }
}
