<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\WrapsApiResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SubscriptionResource extends JsonResource
{
    use WrapsApiResponse;

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'status' => $this->status,
            'start_date' => $this->start_date?->toDateString(),
            'end_date' => $this->end_date?->toDateString(),
            'price_paid' => $this->price_paid,
            'discount' => $this->discount,
            'last_reminded_on' => $this->last_reminded_on?->toDateString(),
            'member' => $this->whenLoaded('member', fn () => (new MemberResource($this->member))->toArray($request)),
            'plan' => $this->whenLoaded('plan', fn () => (new PlanResource($this->plan))->toArray($request)),
            'sold_by' => $this->whenLoaded('soldBy', fn () => (new UserSummaryResource($this->soldBy))->toArray($request)),
            'payments' => $this->whenLoaded('payments', fn () => PaymentResource::collection($this->payments)->resolve()),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
