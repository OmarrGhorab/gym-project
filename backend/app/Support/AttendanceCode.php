<?php

namespace App\Support;

use InvalidArgumentException;

final class AttendanceCode
{
    /**
     * Characters generated codes are drawn from.
     *
     * Excludes O/0 and I/1: the code is printed under the barcode for staff to
     * type when a badge is too worn to scan, and those are the pairs they
     * misread. 32^6 is a billion combinations — ample for a gym.
     */
    private const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

    /**
     * Length of the random portion.
     *
     * Deliberately short. Code128 spends ~11 modules per character, so every
     * extra character makes the printed symbol wider; at 16 characters the
     * badge was too wide to print at a module width a laser can resolve.
     */
    public const RANDOM_LENGTH = 6;

    /** Prefix each code carries, which is what identifies its type. */
    private const TYPE_PREFIXES = ['M-' => 'member', 'E-' => 'employee'];

    public static function prefixFor(string $type): string
    {
        $prefix = array_search(strtolower(trim($type)), self::TYPE_PREFIXES, true);

        if ($prefix === false) {
            throw new InvalidArgumentException('Invalid attendance code type.');
        }

        return $prefix;
    }

    /** The random portion of a new code. */
    public static function randomSuffix(int $length = self::RANDOM_LENGTH): string
    {
        $alphabet = self::ALPHABET;
        $max = strlen($alphabet) - 1;
        $suffix = '';

        for ($i = 0; $i < $length; $i++) {
            $suffix .= $alphabet[random_int(0, $max)];
        }

        return $suffix;
    }

    /**
     * The type a bare code belongs to, from its prefix, or null when the code
     * predates the prefix convention.
     */
    public static function typeFromCode(string $code): ?string
    {
        $code = strtoupper(trim($code));

        foreach (self::TYPE_PREFIXES as $prefix => $type) {
            if (str_starts_with($code, $prefix)) {
                return $type;
            }
        }

        return null;
    }

    /**
     * @return array{type: string, code: string}
     */
    public static function parse(string $value): array
    {
        $value = trim($value);

        if (str_contains($value, ':')) {
            [$type, $code] = explode(':', $value, 2);
            $type = strtolower(trim($type));
            $code = trim($code);

            if (in_array($type, ['member', 'employee'], true) && $code !== '') {
                return ['type' => $type, 'code' => $code];
            }
        }

        throw new InvalidArgumentException('Invalid attendance QR code.');
    }

    /**
     * Accept either a full QR payload, such as "member:M-ABC", or the raw
     * printed attendance code when the scan context already identifies a type.
     *
     * @return array{type: string, code: string}
     */
    public static function parseForType(string $value, string $expectedType): array
    {
        $expectedType = strtolower(trim($expectedType));

        if (! in_array($expectedType, ['member', 'employee'], true)) {
            throw new InvalidArgumentException('Invalid attendance QR type.');
        }

        $value = trim($value);

        if ($value === '') {
            throw new InvalidArgumentException('Invalid attendance QR code.');
        }

        if (! str_contains($value, ':')) {
            // Barcodes encode the bare code to keep the printed symbol narrow,
            // so the M-/E- prefix is what tells a member badge scanned at the
            // staff station from a real staff badge.
            return ['type' => self::typeFromCode($value) ?? $expectedType, 'code' => $value];
        }

        return self::parse($value);
    }

    public static function payload(string $type, string $code): string
    {
        return "{$type}:{$code}";
    }
}
