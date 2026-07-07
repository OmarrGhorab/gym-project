<?php

namespace App\Jobs;

use App\Actions\Commissions\CalculateCommission;
use App\Models\Sale;
use App\Models\Subscription;
use App\Models\SubscriptionAddon;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class CalculateCommissionJob implements ShouldQueue
{
    use Queueable;

    public function __construct(
        private readonly string $sourceType,
        private readonly int|string $sourceId,
    ) {}

    public function handle(CalculateCommission $action): void
    {
        $source = $this->sourceType === Subscription::class
            ? Subscription::find($this->sourceId)
            : ($this->sourceType === SubscriptionAddon::class
                ? SubscriptionAddon::find($this->sourceId)
                : Sale::find($this->sourceId));

        if ($source !== null) {
            $action->forSource($source);
        }
    }
}
