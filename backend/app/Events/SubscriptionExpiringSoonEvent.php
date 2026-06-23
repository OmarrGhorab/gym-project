<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class SubscriptionExpiringSoonEvent implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public readonly int $subscriptionId,
        public readonly ?string $memberName,
        public readonly ?string $endDate,
    ) {}

    public function broadcastOn(): array
    {
        return ['subscriptions'];
    }

    public function broadcastAs(): string
    {
        return 'subscription.expiring';
    }
}
