<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\WrapsApiResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class MemberVisitResource extends JsonResource
{
    use WrapsApiResponse;

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'member_id' => $this->member_id,
            'member' => $this->whenLoaded('member', fn () => [
                'id' => $this->member->id,
                'name' => $this->member->name,
                'phone' => $this->member->phone,
            ]),
            'subscription_id' => $this->subscription_id,
            'subscription' => $this->whenLoaded('subscription', fn () => [
                'id' => $this->subscription?->id,
                'plan_name' => $this->subscription?->plan?->name,
                'status' => $this->subscription?->status,
                'end_date' => $this->subscription?->end_date?->toDateString(),
            ]),
            'check_in_at' => $this->check_in_at?->toIso8601String(),
            'check_out_at' => $this->check_out_at?->toIso8601String(),
            'status' => $this->status,
            'alert_reason' => $this->alert_reason,
            'notes' => $this->notes,
            'creator' => new UserSummaryResource($this->whenLoaded('creator')),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
