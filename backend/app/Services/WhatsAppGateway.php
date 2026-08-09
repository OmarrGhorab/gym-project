<?php

namespace App\Services;

use App\Exceptions\WhatsAppSendException;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

/**
 * HTTP client for the local WhatsApp gateway (whatsapp-service/).
 *
 * The gateway holds the gym's linked WhatsApp session and does the actual
 * sending; this class only speaks to it. It runs on loopback on the same VPS,
 * so there is no retry-on-connection-blip logic here — the caller's queued job
 * owns retries, and it can space them out far better than an inline retry can.
 */
class WhatsAppGateway
{
    public function configured(): bool
    {
        return filled(config('services.whatsapp.url')) && filled(config('services.whatsapp.token'));
    }

    /** Whether automatic sending is switched on at the environment level. */
    public function enabled(): bool
    {
        return (bool) config('services.whatsapp.enabled') && $this->configured();
    }

    /**
     * Connection state of the linked number.
     *
     * Never throws: the settings page calls this to render a status badge, and a
     * gateway that is down should show as down rather than 500 the page.
     *
     * @return array{state: string, connected: bool, number: string|null, error: string|null, queued: int}
     */
    public function status(): array
    {
        $unavailable = [
            'state' => $this->configured() ? 'unreachable' : 'not_configured',
            'connected' => false,
            'number' => null,
            'error' => $this->configured() ? 'The WhatsApp service is not responding.' : 'WhatsApp service URL or token is not set.',
            'queued' => 0,
        ];

        if (! $this->configured()) {
            return $unavailable;
        }

        try {
            $response = $this->request()->get('/status');
        } catch (ConnectionException $e) {
            return [...$unavailable, 'error' => $e->getMessage()];
        }

        if (! $response->successful()) {
            return [...$unavailable, 'error' => $this->reason($response)];
        }

        return [
            'state' => (string) $response->json('state', 'unknown'),
            'connected' => (bool) $response->json('connected', false),
            'number' => $response->json('number'),
            'error' => $response->json('error'),
            'queued' => (int) $response->json('queued', 0),
        ];
    }

    /**
     * The pending pairing QR as a data URL, or null when already linked.
     *
     * @return array{qr: string|null, state: string}
     */
    public function qr(): array
    {
        if (! $this->configured()) {
            return ['qr' => null, 'state' => 'not_configured'];
        }

        try {
            $response = $this->request()->get('/qr');
        } catch (ConnectionException) {
            return ['qr' => null, 'state' => 'unreachable'];
        }

        if (! $response->successful()) {
            return ['qr' => null, 'state' => 'unreachable'];
        }

        return [
            'qr' => $response->json('qr'),
            'state' => (string) $response->json('state', 'unknown'),
        ];
    }

    /** Unlink the number, forcing a fresh QR scan. */
    public function logout(): bool
    {
        if (! $this->configured()) {
            return false;
        }

        try {
            return $this->request()->post('/logout')->successful();
        } catch (ConnectionException) {
            return false;
        }
    }

    /**
     * Send one message, returning the gateway's message id.
     *
     * @throws WhatsAppSendException
     */
    public function send(string $phone, string $message, ?string $imageUrl = null): ?string
    {
        if (! $this->configured()) {
            throw WhatsAppSendException::permanent('WhatsApp service URL or token is not configured.', 'not_configured');
        }

        try {
            $response = $this->request()->post('/send', array_filter([
                'phone' => $phone,
                'message' => $message,
                'image_url' => $imageUrl,
            ], static fn ($value): bool => $value !== null));
        } catch (ConnectionException $e) {
            // The gateway is restarting or not up yet. Worth retrying.
            throw WhatsAppSendException::retryable($e->getMessage(), 'unreachable');
        }

        if ($response->successful()) {
            return $response->json('id');
        }

        $reason = $this->reason($response);
        $code = (string) $response->json('code', 'send_failed');

        // 429 queue full, 503 not linked, 504 timed out, 5xx gateway fault — all
        // transient. 422 (bad number, or not on WhatsApp) and 401 (wrong token)
        // will fail identically forever, so retrying only delays the failure
        // report and wastes queue capacity.
        throw match (true) {
            in_array($response->status(), [429, 503, 504], true) => WhatsAppSendException::retryable($reason, $code),
            $response->serverError() => WhatsAppSendException::retryable($reason, $code),
            default => WhatsAppSendException::permanent($reason, $code),
        };
    }

    private function request(): PendingRequest
    {
        return Http::baseUrl((string) config('services.whatsapp.url'))
            ->withToken((string) config('services.whatsapp.token'))
            ->acceptJson()
            ->timeout((int) config('services.whatsapp.timeout', 90));
    }

    private function reason(Response $response): string
    {
        return (string) ($response->json('message') ?: "WhatsApp service returned HTTP {$response->status()}.");
    }
}
