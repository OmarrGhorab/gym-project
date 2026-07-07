<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\WrapsApiResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SubscriptionAddonResource extends JsonResource
{
    use WrapsApiResponse;

    public function toArray(Request $request): array
    {
        $this->loadMissing(['payments', 'plan', 'coach']);

        return [
            'id' => $this->id,
            'subscription_id' => $this->subscription_id,
            'member_id' => $this->member_id,
            'plan_id' => $this->plan_id,
            'coach_id' => $this->coach_id,
            'status' => $this->status,
            'start_date' => $this->start_date?->toDateString(),
            'end_date' => $this->end_date?->toDateString(),
            'price_paid' => $this->price_paid,
            'discount' => $this->discount,
            'sessions_total' => $this->sessions_total,
            'sessions_remaining' => $this->sessions_remaining,
            'paid_total' => $this->payments->reduce(
                fn (string $carry, $payment): string => bcadd($carry, (string) $payment->amount, 2),
                '0.00',
            ),
            'plan' => $this->whenLoaded('plan', fn () => (new PlanResource($this->plan))->toArray($request)),
            'coach' => $this->whenLoaded('coach', fn () => [
                'id' => $this->coach?->id,
                'name' => $this->coach?->name,
                'role' => $this->coach?->role,
            ]),
            'payments' => $this->whenLoaded('payments', fn () => PaymentResource::collection($this->payments)->resolve()),
        ];
    }
}
