<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\WrapsApiResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SubscriptionFreezeResource extends JsonResource
{
    use WrapsApiResponse;

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'subscription_id' => $this->subscription_id,
            'freeze_start' => $this->freeze_start?->toDateString(),
            'freeze_end' => $this->freeze_end?->toDateString(),
            'resumed_on' => $this->resumed_on?->toDateString(),
            'days' => $this->days,
            'remaining_days_at_freeze' => $this->remaining_days_at_freeze,
            'reason' => $this->reason,
            'created_by' => $this->created_by,
            'approval_status' => $this->approval_status,
            'approved_by' => $this->approved_by,
            'approved_at' => $this->approved_at?->toIso8601String(),
            'dismissed_by' => $this->dismissed_by,
            'dismissed_at' => $this->dismissed_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
