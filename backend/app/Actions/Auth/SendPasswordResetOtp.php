<?php

namespace App\Actions\Auth;

use App\Models\User;
use App\Notifications\Auth\SendPasswordResetOtp as SendPasswordResetOtpNotification;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/**
 * Generates and sends a one-time password (OTP) for password reset.
 *
 * The OTP is hashed before storage and is valid for a short window. The
 * action is intentionally silent about whether the email exists; callers
 * should always return the same success message to avoid account enumeration.
 */
final class SendPasswordResetOtp
{
    private const OTP_LENGTH = 6;

    private const EXPIRY_MINUTES = 15;

    public function handle(string $email): void
    {
        $user = User::where('email', $email)->first();

        if ($user === null) {
            return;
        }

        $otp = $this->generateOtp();

        DB::transaction(function () use ($email, $otp): void {
            DB::table('password_reset_otps')
                ->where('email', $email)
                ->delete();

            DB::table('password_reset_otps')->insert([
                'email' => $email,
                'otp_hash' => Hash::make($otp),
                'expires_at' => now()->addMinutes(self::EXPIRY_MINUTES),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        });

        $user->notify(new SendPasswordResetOtpNotification($otp));
    }

    private function generateOtp(): string
    {
        return (string) random_int(
            10 ** (self::OTP_LENGTH - 1),
            (10 ** self::OTP_LENGTH) - 1,
        );
    }
}
