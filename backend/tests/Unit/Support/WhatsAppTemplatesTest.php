<?php

use App\Support\WhatsAppTemplates;

it('substitutes placeholders', function (): void {
    $rendered = WhatsAppTemplates::render('Hi {{member_name}}, {{plan_name}} ends {{end_date}}.', [
        'member_name' => 'Omar',
        'plan_name' => 'Gold',
        'end_date' => '2026-09-01',
    ]);

    expect($rendered)->toBe('Hi Omar, Gold ends 2026-09-01.');
});

it('tolerates whitespace and casing inside a placeholder', function (): void {
    expect(WhatsAppTemplates::render('Hi {{ Member_Name }}', ['member_name' => 'Omar']))
        ->toBe('Hi Omar');
});

/**
 * An unresolved placeholder must never reach a member: "أهلاً {{member_name}}"
 * reads as a broken system, so a missing value collapses to nothing instead.
 */
it('renders a missing or null value as empty rather than leaving the placeholder', function (): void {
    expect(WhatsAppTemplates::render('A{{unknown}}B', []))->toBe('AB')
        ->and(WhatsAppTemplates::render('A{{sessions_remaining}}B', ['sessions_remaining' => null]))->toBe('AB');
});

it('renders a zero session count rather than treating it as empty', function (): void {
    expect(WhatsAppTemplates::render('{{sessions_remaining}} left', ['sessions_remaining' => 0]))
        ->toBe('0 left');
});

it('prefers the gym edited template over the default', function (): void {
    $body = WhatsAppTemplates::body(WhatsAppTemplates::EXPIRY_REMINDER, [
        WhatsAppTemplates::EXPIRY_REMINDER => 'Custom text',
    ]);

    expect($body)->toBe('Custom text');
});

it('falls back to the default when the stored override is blank', function (): void {
    $body = WhatsAppTemplates::body(WhatsAppTemplates::EXPIRY_REMINDER, [
        WhatsAppTemplates::EXPIRY_REMINDER => '   ',
    ]);

    expect($body)->toBe(WhatsAppTemplates::defaults()[WhatsAppTemplates::EXPIRY_REMINDER]);
});

it('has a default body for every key it advertises', function (): void {
    foreach (WhatsAppTemplates::keys() as $key) {
        expect(WhatsAppTemplates::body($key))->toBeString()->not->toBe('');
    }
});

it('returns null for an unknown template key', function (): void {
    expect(WhatsAppTemplates::body('not_a_template'))->toBeNull();
});

/**
 * Code128, and the bare code rather than the "member:" payload — the gym's
 * laser scanners cannot read a 2D symbol, and the prefix makes the printed
 * symbol wider for no benefit. Mirrors buildBarcodeImageUrl() in the frontend.
 */
it('builds a Code128 url from a bare attendance code', function (): void {
    expect(WhatsAppTemplates::barcodeImageUrl('M-ABC234'))
        ->toBe('https://barcodeapi.org/api/128/M-ABC234');
});

it('strips a type prefix from the payload form', function (): void {
    expect(WhatsAppTemplates::barcodeImageUrl('member:M-ABC234'))
        ->toBe('https://barcodeapi.org/api/128/M-ABC234');
});

it('has no barcode url without a code', function (): void {
    expect(WhatsAppTemplates::barcodeImageUrl(null))->toBeNull()
        ->and(WhatsAppTemplates::barcodeImageUrl('  '))->toBeNull();
});
