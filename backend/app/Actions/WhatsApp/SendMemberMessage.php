<?php

namespace App\Actions\WhatsApp;

use App\Jobs\SendWhatsAppMessageJob;
use App\Models\Setting;
use App\Models\Subscription;
use App\Models\WhatsAppMessage;
use App\Services\WhatsAppGateway;
use App\Support\SubscriptionMessagePayload;
use App\Support\WhatsAppPhone;
use App\Support\WhatsAppTemplates;
use Illuminate\Support\Facades\Cache;

/**
 * Queues one automatic WhatsApp message to a member.
 *
 * This is the single entry point for automatic sending. Every gate — the env
 * kill switch, the gym's per-event toggles, the duplicate check — lives here so
 * that callers (an observer, a scheduled job, a check-in action) stay one line
 * and cannot accidentally skip one.
 *
 * Returns the queued row, or null when nothing was queued.
 */
final class SendMemberMessage
{
    public function __construct(
        private readonly WhatsAppGateway $gateway,
    ) {}

    public function handle(Subscription $subscription, string $templateKey): ?WhatsAppMessage
    {
        if (! $this->gateway->enabled() || ! $this->eventEnabled($templateKey)) {
            return null;
        }

        $subscription->loadMissing(SubscriptionMessagePayload::RELATIONS);

        if ($this->alreadyQueued($subscription, $templateKey)) {
            return null;
        }

        $template = WhatsAppTemplates::body($templateKey, $this->settings('whatsapp.templates', []));

        if ($template === null) {
            return null;
        }

        $payload = SubscriptionMessagePayload::for($subscription);
        $barcodeUrl = WhatsAppTemplates::barcodeImageUrl($payload['attendance_code'] ?? null);

        $body = WhatsAppTemplates::render($template, [
            'amount_paid' => $payload['amount_paid'] ?? '',
            'barcode_url' => $barcodeUrl ?? '',
            'end_date' => $payload['end_date'] ?? '',
            'member_name' => $payload['member_name'] ?? '',
            'plan_name' => $payload['plan_name'] ?? '',
            'sessions_remaining' => $payload['sessions_remaining'],
            'start_date' => $payload['start_date'] ?? '',
        ]);

        $phone = WhatsAppPhone::normalize($payload['member_phone'] ?? null);

        // Recorded rather than silently dropped: "this member has no usable
        // phone number" is something the gym needs to see and fix.
        if ($phone === null) {
            return WhatsAppMessage::create([
                'member_id' => $subscription->member_id,
                'subscription_id' => $subscription->id,
                'template_key' => $templateKey,
                'phone' => '',
                'body' => $body,
                'status' => WhatsAppMessage::STATUS_FAILED,
                'error' => 'Member has no phone number.',
            ]);
        }

        $message = WhatsAppMessage::create([
            'member_id' => $subscription->member_id,
            'subscription_id' => $subscription->id,
            'template_key' => $templateKey,
            'phone' => $phone,
            'body' => $body,
            // Send the barcode as a real image the member can hold up to the
            // scanner, but only when the template asked for one. The URL stays
            // in the text as a fallback if the image fails to load.
            'image_url' => str_contains($template, '{{barcode_url}}') ? $barcodeUrl : null,
            'status' => WhatsAppMessage::STATUS_PENDING,
        ]);

        // afterCommit because check-in deducts a session inside a transaction:
        // without it the worker can pick the job up before the row is visible.
        SendWhatsAppMessageJob::dispatch($message->id)->afterCommit();

        return $message;
    }

    /**
     * Which confirmation a new subscription should get.
     *
     * A renewal creates a new subscription row just like a first signup does, so
     * the only way to tell them apart is whether the member has an older one.
     */
    public function confirmationKeyFor(Subscription $subscription): string
    {
        $hasEarlier = Subscription::query()
            ->where('member_id', $subscription->member_id)
            ->whereKeyNot($subscription->getKey())
            ->where('created_at', '<=', $subscription->created_at ?? now())
            ->exists();

        return $hasEarlier
            ? WhatsAppTemplates::RENEWAL_CONFIRMATION
            : WhatsAppTemplates::SUBSCRIPTION_CONFIRMATION;
    }

    /**
     * Whether this event is switched on in Settings -> WhatsApp.
     *
     * Both the master switch and the per-event toggle default to off: turning
     * automatic messaging on is a decision the gym makes deliberately, not
     * something a deploy does for them.
     */
    private function eventEnabled(string $templateKey): bool
    {
        if (! (bool) $this->settings('whatsapp.auto_send', false)) {
            return false;
        }

        $events = $this->settings('whatsapp.auto_events', []);

        return is_array($events) && (bool) ($events[$templateKey] ?? false);
    }

    private function alreadyQueued(Subscription $subscription, string $templateKey): bool
    {
        return WhatsAppMessage::query()
            ->where('subscription_id', $subscription->id)
            ->where('template_key', $templateKey)
            ->whereIn('status', WhatsAppMessage::BLOCKING_STATUSES)
            ->exists();
    }

    private function settings(string $key, mixed $default = null): mixed
    {
        $all = Cache::rememberForever(
            'settings.all',
            fn () => Setting::all()->pluck('value', 'key')->toArray(),
        );

        return $all[$key] ?? $default;
    }
}
