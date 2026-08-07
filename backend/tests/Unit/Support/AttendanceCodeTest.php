<?php

use App\Support\AttendanceCode;

/**
 * Code length is a functional property, not cosmetics: Code128 spends ~11
 * modules per character, so a long code prints a symbol too wide for a badge
 * and too dense for a 1D laser to resolve.
 */
it('generates a code short enough to print as a scannable badge', function (): void {
    $code = AttendanceCode::prefixFor('member').AttendanceCode::randomSuffix();

    expect($code)->toStartWith('M-');
    expect(strlen($code))->toBe(2 + AttendanceCode::RANDOM_LENGTH);
});

it('prefixes employee codes distinctly from member codes', function (): void {
    expect(AttendanceCode::prefixFor('employee'))->toBe('E-');
    expect(AttendanceCode::prefixFor('member'))->toBe('M-');
});

it('rejects an unknown code type', function (): void {
    expect(fn () => AttendanceCode::prefixFor('coach'))
        ->toThrow(InvalidArgumentException::class);
});

it('omits characters that are misread when the code is typed by hand', function (): void {
    // O/0 and I/1 are the pairs staff confuse when a badge is too worn to scan.
    $suffixes = collect(range(1, 200))->map(fn (): string => AttendanceCode::randomSuffix())->implode('');

    expect($suffixes)->not->toContain('O')
        ->and($suffixes)->not->toContain('0')
        ->and($suffixes)->not->toContain('I')
        ->and($suffixes)->not->toContain('1');
});

it('draws on enough of the alphabet to stay unguessable', function (): void {
    $characters = collect(range(1, 400))
        ->map(fn (): string => AttendanceCode::randomSuffix())
        ->implode('');

    expect(count(array_unique(str_split($characters))))->toBeGreaterThan(25);
});

it('generates unique codes', function (): void {
    $codes = collect(range(1, 300))->map(fn (): string => AttendanceCode::randomSuffix());

    expect($codes->unique()->count())->toBe(300);
});

it('reads a bare barcode payload as the type its prefix declares', function (): void {
    // Badges encode the bare code, so the prefix is the only type signal.
    expect(AttendanceCode::parseForType('M-K7QX9F', 'member'))
        ->toBe(['type' => 'member', 'code' => 'M-K7QX9F']);

    expect(AttendanceCode::parseForType('E-K7QX9F', 'employee'))
        ->toBe(['type' => 'employee', 'code' => 'E-K7QX9F']);
});

it('flags a member badge scanned at the staff station', function (): void {
    // Without prefix inference this silently became "employee not found".
    expect(AttendanceCode::parseForType('M-K7QX9F', 'employee')['type'])->toBe('member');
});

it('still accepts the prefixed payload a QR badge carries', function (): void {
    expect(AttendanceCode::parseForType('member:M-K7QX9F', 'member'))
        ->toBe(['type' => 'member', 'code' => 'M-K7QX9F']);
});

it('assumes the scanning station for codes without a known prefix', function (): void {
    expect(AttendanceCode::parseForType('LEGACY123', 'member'))
        ->toBe(['type' => 'member', 'code' => 'LEGACY123']);
});

it('rejects an empty payload', function (): void {
    expect(fn () => AttendanceCode::parseForType('', 'member'))
        ->toThrow(InvalidArgumentException::class);
});
