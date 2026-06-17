<?php

namespace App\Support;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;

/**
 * Helper for generating and verifying short-lived one-time passwords (OTPs).
 *
 * OTPs are hashed before storage so a database leak does not immediately
 * reveal usable codes. Storage and expiry logic lives in the actions that
 * consume this helper.
 */
final class Otp
{
    private const LENGTH = 6;

    private const EXPIRY_MINUTES = 15;

    public static function generate(): string
    {
        return (string) random_int(
            10 ** (self::LENGTH - 1),
            (10 ** self::LENGTH) - 1,
        );
    }

    public static function hash(string $otp): string
    {
        return Hash::make($otp);
    }

    public static function verify(string $otp, string $hash): bool
    {
        return Hash::check($otp, $hash);
    }

    public static function expiry(): Carbon
    {
        return now()->addMinutes(self::EXPIRY_MINUTES);
    }
}
