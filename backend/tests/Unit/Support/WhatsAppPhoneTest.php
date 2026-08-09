<?php

use App\Support\WhatsAppPhone;

/**
 * Members are stored with local Egyptian numbers, which WhatsApp cannot route.
 * Getting this wrong does not error — it silently messages the wrong person, or
 * nobody — so every stored shape is pinned here.
 */
it('converts a local Egyptian number to international form', function (): void {
    expect(WhatsAppPhone::normalize('01012345678'))->toBe('201012345678');
});

it('leaves an already international number alone', function (): void {
    expect(WhatsAppPhone::normalize('201012345678'))->toBe('201012345678');
});

it('strips formatting characters', function (): void {
    expect(WhatsAppPhone::normalize('+20 101 234 5678'))->toBe('201012345678')
        ->and(WhatsAppPhone::normalize('(010) 1234-5678'))->toBe('201012345678');
});

it('replaces the 00 dialling prefix with none', function (): void {
    expect(WhatsAppPhone::normalize('00201012345678'))->toBe('201012345678');
});

it('returns null when there is nothing to dial', function (): void {
    expect(WhatsAppPhone::normalize(null))->toBeNull()
        ->and(WhatsAppPhone::normalize(''))->toBeNull()
        ->and(WhatsAppPhone::normalize('  '))->toBeNull()
        ->and(WhatsAppPhone::normalize('n/a'))->toBeNull();
});

/**
 * The automatic send and the dashboard's manual wa.me button must reach the
 * same person, so this mirrors normalizeWhatsAppPhone() in
 * frontend/src/lib/whatsapp.ts case for case.
 */
it('agrees with the frontend normaliser on every stored shape', function (string $input, ?string $expected): void {
    expect(WhatsAppPhone::normalize($input))->toBe($expected);
})->with([
    ['01012345678', '201012345678'],
    ['+201012345678', '201012345678'],
    ['00201012345678', '201012345678'],
    ['201012345678', '201012345678'],
    ['1012345678', '1012345678'],
]);
