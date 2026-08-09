<?php

namespace App\Http\Controllers\Api\V1;

use App\Services\WhatsAppGateway;
use Illuminate\Http\JsonResponse;

/**
 * Linking and health of the gym's WhatsApp number.
 *
 * Message templates and the per-event toggles are ordinary settings and stay in
 * SettingController; this controller only covers what lives in the gateway
 * process rather than the database.
 */
class WhatsAppController extends ApiController
{
    public function connection(WhatsAppGateway $gateway): JsonResponse
    {
        return $this->success(
            data: [
                // Reports the env kill switch separately from the gym's toggles,
                // so the UI can explain "your toggles are on, but this server is
                // not configured to send" rather than silently doing nothing.
                'enabled' => $gateway->enabled(),
                'configured' => $gateway->configured(),
                ...$gateway->status(),
            ],
            message: 'WhatsApp connection status retrieved successfully',
        );
    }

    public function qr(WhatsAppGateway $gateway): JsonResponse
    {
        return $this->success(
            data: $gateway->qr(),
            message: 'WhatsApp pairing code retrieved successfully',
        );
    }

    public function logout(WhatsAppGateway $gateway): JsonResponse
    {
        if (! $gateway->logout()) {
            return $this->error(
                code: 'whatsapp_unreachable',
                message: 'Could not reach the WhatsApp service to unlink the number.',
                status: 503,
            );
        }

        return $this->success(message: 'WhatsApp number unlinked successfully');
    }
}
