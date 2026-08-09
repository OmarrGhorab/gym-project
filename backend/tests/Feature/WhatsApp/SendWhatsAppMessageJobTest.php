<?php

use App\Exceptions\WhatsAppSendException;
use App\Jobs\SendWhatsAppMessageJob;
use App\Models\WhatsAppMessage;
use App\Services\WhatsAppGateway;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    config()->set('services.whatsapp.enabled', true);
    config()->set('services.whatsapp.url', 'http://127.0.0.1:3001');
    config()->set('services.whatsapp.token', 'test-token');
});

function pendingWhatsAppMessage(array $attributes = []): WhatsAppMessage
{
    return WhatsAppMessage::create(array_merge([
        'template_key' => 'expiry_reminder',
        'phone' => '201012345678',
        'body' => 'Hello',
        'status' => WhatsAppMessage::STATUS_PENDING,
    ], $attributes));
}

function runWhatsAppJob(WhatsAppMessage $message): void
{
    (new SendWhatsAppMessageJob($message->id))->handle(app(WhatsAppGateway::class));
}

test('marks the message sent and records the gateway id', function (): void {
    Http::fake(['*/send' => Http::response(['ok' => true, 'id' => 'ABC123'])]);
    $message = pendingWhatsAppMessage();

    runWhatsAppJob($message);

    expect($message->fresh())
        ->status->toBe(WhatsAppMessage::STATUS_SENT)
        ->provider_message_id->toBe('ABC123')
        ->sent_at->not->toBeNull()
        ->error->toBeNull();
});

test('sends the barcode as an image when one is attached', function (): void {
    Http::fake(['*/send' => Http::response(['ok' => true, 'id' => 'ABC123'])]);

    runWhatsAppJob(pendingWhatsAppMessage(['image_url' => 'https://barcodeapi.org/api/128/M-ABC234']));

    Http::assertSent(fn ($request): bool => $request['image_url'] === 'https://barcodeapi.org/api/128/M-ABC234'
        && $request['phone'] === '201012345678');
});

/**
 * A number that is not on WhatsApp fails identically forever. Retrying it only
 * delays the failure report and occupies queue capacity that real sends need.
 */
test('gives up immediately when the number cannot receive WhatsApp', function (): void {
    Http::fake(['*/send' => Http::response(['message' => '201012345678 is not registered on WhatsApp', 'code' => 'not_on_whatsapp'], 422)]);
    $message = pendingWhatsAppMessage();

    runWhatsAppJob($message);

    expect($message->fresh())
        ->status->toBe(WhatsAppMessage::STATUS_FAILED)
        ->error->toContain('not registered on WhatsApp');
});

test('gives up immediately when the service token is wrong', function (): void {
    Http::fake(['*/send' => Http::response(['message' => 'Unauthorized'], 401)]);
    $message = pendingWhatsAppMessage();

    runWhatsAppJob($message);

    expect($message->fresh()->status)->toBe(WhatsAppMessage::STATUS_FAILED);
});

/**
 * These clear on their own — the number gets re-linked, the queue drains — so
 * the job throws and lets the queue retry it on the backoff schedule.
 */
test('retries when the number is unlinked, the queue is full, or the send times out', function (int $status): void {
    Http::fake(['*/send' => Http::response(['message' => 'later'], $status)]);
    $message = pendingWhatsAppMessage();

    expect(fn () => runWhatsAppJob($message))->toThrow(WhatsAppSendException::class);

    // Still pending, so a retry will pick it up rather than skip it.
    expect($message->fresh()->status)->toBe(WhatsAppMessage::STATUS_PENDING);
})->with([503, 429, 504, 500]);

test('retries when the gateway process is not reachable', function (): void {
    Http::fake(fn () => throw new ConnectionException('Connection refused'));
    $message = pendingWhatsAppMessage();

    expect(fn () => runWhatsAppJob($message))->toThrow(WhatsAppSendException::class);
    expect($message->fresh()->status)->toBe(WhatsAppMessage::STATUS_PENDING);
});

test('does not send the same message twice', function (): void {
    Http::fake(['*/send' => Http::response(['ok' => true, 'id' => 'ABC123'])]);
    $message = pendingWhatsAppMessage(['status' => WhatsAppMessage::STATUS_SENT]);

    runWhatsAppJob($message);

    Http::assertNothingSent();
});

test('marks the message failed once the queue exhausts its retries', function (): void {
    $message = pendingWhatsAppMessage();

    (new SendWhatsAppMessageJob($message->id))->failed(new RuntimeException('gave up'));

    expect($message->fresh())
        ->status->toBe(WhatsAppMessage::STATUS_FAILED)
        ->error->toBe('gave up');
});

test('leaves an already sent message alone when a later retry fails', function (): void {
    $message = pendingWhatsAppMessage(['status' => WhatsAppMessage::STATUS_SENT]);

    (new SendWhatsAppMessageJob($message->id))->failed(new RuntimeException('gave up'));

    expect($message->fresh()->status)->toBe(WhatsAppMessage::STATUS_SENT);
});
