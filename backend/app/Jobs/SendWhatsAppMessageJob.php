<?php

namespace App\Jobs;

use App\Exceptions\WhatsAppSendException;
use App\Models\WhatsAppMessage;
use App\Services\WhatsAppGateway;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;
use Throwable;

class SendWhatsAppMessageJob implements ShouldQueue
{
    use Queueable;

    public int $tries = 5;

    /**
     * Longer than a normal HTTP job: the gateway spaces sends 5–20 seconds apart
     * and a message may wait behind others already in its queue.
     */
    public int $timeout = 120;

    public function __construct(
        public int $messageId,
    ) {}

    /**
     * Slow, widening backoff. The transient failures here are "the number is
     * unlinked" and "the gateway queue is full", both of which take minutes to
     * clear, not seconds.
     *
     * @return list<int>
     */
    public function backoff(): array
    {
        return [60, 300, 900, 1800];
    }

    public function handle(WhatsAppGateway $gateway): void
    {
        $message = WhatsAppMessage::find($this->messageId);

        if (! $message || $message->status === WhatsAppMessage::STATUS_SENT) {
            return;
        }

        $message->update(['attempts' => $this->attempts()]);

        try {
            $providerId = $gateway->send($message->phone, $message->body, $message->image_url);
        } catch (WhatsAppSendException $e) {
            if ($e->retryable) {
                // Record why it is taking a while, then let the queue retry it.
                $message->update(['error' => $e->getMessage()]);

                throw $e;
            }

            // Nothing about a wrong number or a bad token improves with another
            // attempt — record the reason and stop.
            $message->update([
                'status' => WhatsAppMessage::STATUS_FAILED,
                'error' => $e->getMessage(),
            ]);

            Log::warning('WhatsApp message permanently failed', [
                'whatsapp_message_id' => $message->id,
                'member_id' => $message->member_id,
                'template_key' => $message->template_key,
                'code' => $e->gatewayCode,
            ]);

            return;
        }

        $message->update([
            'status' => WhatsAppMessage::STATUS_SENT,
            'provider_message_id' => $providerId,
            'error' => null,
            'sent_at' => now(),
        ]);
    }

    public function failed(Throwable $e): void
    {
        WhatsAppMessage::query()
            ->whereKey($this->messageId)
            ->where('status', '!=', WhatsAppMessage::STATUS_SENT)
            ->update([
                'status' => WhatsAppMessage::STATUS_FAILED,
                'error' => $e->getMessage(),
            ]);

        Log::error('SendWhatsAppMessageJob failed', [
            'whatsapp_message_id' => $this->messageId,
            'error' => $e->getMessage(),
        ]);
    }
}
