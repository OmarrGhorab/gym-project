<?php

namespace App\Support;

use Illuminate\Support\Str;

final class ArabicSearch
{
    /**
     * Arabic users often type visually similar letters interchangeably.
     * Keep search forgiving while leaving stored names unchanged.
     */
    private const REPLACEMENTS = [
        'أ' => 'ا',
        'إ' => 'ا',
        'آ' => 'ا',
        'ٱ' => 'ا',
        'ى' => 'ي',
        'ئ' => 'ي',
        'ی' => 'ي',
        'ؤ' => 'و',
        'ة' => 'ه',
        'ک' => 'ك',
        'ـ' => '',
        'َ' => '',
        'ً' => '',
        'ُ' => '',
        'ٌ' => '',
        'ِ' => '',
        'ٍ' => '',
        'ْ' => '',
        'ّ' => '',
    ];

    public static function normalize(?string $value): string
    {
        return strtr(Str::lower(trim((string) $value)), self::REPLACEMENTS);
    }

    public static function like(string $value, bool $startsWith = false): string
    {
        $normalized = self::normalize($value);

        return $startsWith ? "{$normalized}%" : "%{$normalized}%";
    }

    public static function normalizedColumn(string $column): string
    {
        $expression = "LOWER({$column})";

        foreach (self::REPLACEMENTS as $from => $to) {
            $expression = "REPLACE({$expression}, '{$from}', '{$to}')";
        }

        return $expression;
    }
}
