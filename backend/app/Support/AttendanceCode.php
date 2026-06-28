<?php

namespace App\Support;

use InvalidArgumentException;

final class AttendanceCode
{
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
            return ['type' => $expectedType, 'code' => $value];
        }

        return self::parse($value);
    }

    public static function payload(string $type, string $code): string
    {
        return "{$type}:{$code}";
    }
}
