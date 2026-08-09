<?php

namespace App\Jobs;

use App\Actions\WhatsApp\SendMemberMessage;
use App\Events\SubscriptionExpiringSoonEvent;
use App\Models\Subscription;
use App\Notifications\SubscriptionRenewalReminder;
use App\Services\OperationalNotifier;
use App\Support\WhatsAppTemplates;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;

class SendRenewalReminderJob implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public int $timeout = 30;

    public function __construct(
        public int $subscriptionId,
    ) {}

    public function handle(): void
    {
        $subscription = Subscription::query()
            ->with(['member', 'soldBy'])
            ->findOrFail($this->subscriptionId);

        $today = Carbon::today();

        if ($subscription->last_reminded_on?->isSameDay($today)) {
            return;
        }

        if ($subscription->soldBy) {
            $subscription->soldBy->notify(new SubscriptionRenewalReminder([
                'subscription_id' => $subscription->id,
                'member_id' => $subscription->member_id,
                'member_name' => $subscription->member?->name,
                'member_phone' => $subscription->member?->phone,
                'end_date' => $subscription->end_date?->toDateString(),
            ]));
        }

        app(OperationalNotifier::class)->subscriptionEndingSoon($subscription);

        // Remind the member directly. SendMemberMessage dedupes per subscription,
        // so a multi-step reminder ladder (reminder_days of [7, 3, 1]) still
        // produces exactly one WhatsApp message.
        app(SendMemberMessage::class)->handle($subscription, WhatsAppTemplates::EXPIRY_REMINDER);

        SubscriptionExpiringSoonEvent::dispatch(
            $subscription->id,
            $subscription->member?->name,
            $subscription->end_date?->toDateString(),
        );

        $subscription->update([
            'last_reminded_on' => $today->toDateString(),
        ]);
    }

    public function failed(\Throwable $e): void
    {
        Log::error('SendRenewalReminderJob failed', [
            'subscription_id' => $this->subscriptionId,
            'error' => $e->getMessage(),
        ]);
    }
}
