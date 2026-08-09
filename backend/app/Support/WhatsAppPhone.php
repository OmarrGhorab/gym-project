<?php

namespace App\Support;

final class WhatsAppPhone
{
    /**
     * A member's phone as WhatsApp wants it: digits only, country code included,
     * no leading +.
     *
     * Deliberately mirrors normalizeWhatsAppPhone() in the frontend's
     * lib/whatsapp.ts, so the automatic send and the manual wa.me button address
     * the same person. Members are stored with local Egyptian numbers
     * ("01012345678"), which WhatsApp cannot route.
     *
     * Returns null when there are no digits at all — the caller records that as
     * a failed send rather than guessing at a number.
     */
    public static function normalize(?string $phone): ?string
    {
        $digits = preg_replace('/\D+/', '', (string) $phone) ?? '';

        if ($digits === '') {
            return null;
        }

        // Already international.
        if (str_starts_with($digits, '20')) {
            return $digits;
        }

        // International with the 00 dialling prefix instead of +.
        if (str_starts_with($digits, '0020')) {
            return substr($digits, 2);
        }

        // Local Egyptian: swap the trunk 0 for the country code.
        if (str_starts_with($digits, '0')) {
            return '20'.substr($digits, 1);
        }

        return $digits;
    }
}
