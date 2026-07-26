<?php

namespace App\Notifications;

use App\Notifications\Channels\ProviderHookChannel;
use App\Support\NotificationLink;
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
        $link = NotificationLink::member(
            $this->payload['member_id'] ?? null,
            $this->payload['member_phone'] ?? null,
            ['subscription' => $this->payload['subscription_id'] ?? null],
        );

        return [
            'subscription_id' => $this->payload['subscription_id'] ?? null,
            'member_id' => $this->payload['member_id'] ?? null,
            'member_name' => $this->payload['member_name'] ?? null,
            'member_phone' => $this->payload['member_phone'] ?? null,
            'end_date' => $this->payload['end_date'] ?? null,
            'category' => 'membership.renewal_reminder',
            'message' => 'Subscription renewal reminder.',
            'url' => $link['url'],
            'link' => $link,
        ];
    }
}
