<?php

namespace App\Actions\Auth;

use App\Models\User;
use App\Notifications\Auth\SendPasswordResetOtp as SendPasswordResetOtpNotification;
use App\Support\Otp;
use Illuminate\Support\Facades\DB;

/**
 * Generates and sends a one-time password (OTP) for password reset.
 *
 * The OTP is hashed before storage and is valid for a short window. The
 * action is intentionally silent about whether the email exists; callers
 * should always return the same success message to avoid account enumeration.
 */
final class SendPasswordResetOtp
{
    public function handle(string $email): void
    {
        $user = User::where('email', $email)->first();

        if ($user === null) {
            return;
        }

        $otp = Otp::generate();

        DB::transaction(function () use ($email, $otp): void {
            DB::table('password_reset_otps')
                ->where('email', $email)
                ->delete();

            DB::table('password_reset_otps')->insert([
                'email' => $email,
                'otp_hash' => Otp::hash($otp),
                'expires_at' => Otp::expiry(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        });

        $user->notify(new SendPasswordResetOtpNotification($otp));
    }
}
