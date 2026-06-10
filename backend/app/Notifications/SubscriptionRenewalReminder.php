<?php

namespace App\Notifications;

use App\Notifications\Channels\ProviderHookChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class SubscriptionRenewalReminder extends Notification
{
    use Queueable;

    /**
     * @param  array<string, mixed>  $payload
     */
    public function __construct(
        public array $payload,
    ) {}

    public function via(object $notifiable): array
    {
        $channels = ['database'];

        if (config('services.messaging.driver')) {
            $channels[] = ProviderHookChannel::class;
        }

        return $channels;
    }

    public function toArray(object $notifiable): array
    {
        return [
            'subscription_id' => $this->payload['subscription_id'],
            'member_name' => $this->payload['member_name'],
            'end_date' => $this->payload['end_date'],
            'message' => 'Subscription renewal reminder.',
        ];
    }
}
