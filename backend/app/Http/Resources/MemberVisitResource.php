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
                'attendance_code' => $this->member->attendance_code,
            ]),
            'subscription_id' => $this->subscription_id,
            'subscription' => $this->whenLoaded('subscription', fn () => [
                'id' => $this->subscription?->id,
                'plan_name' => $this->subscription?->plan?->name,
                'status' => $this->subscription?->status,
                'end_date' => $this->subscription?->end_date?->toDateString(),
                'sessions_total' => $this->subscription?->sessions_total,
                'sessions_remaining' => $this->subscription?->sessions_remaining,
            ]),
            'subscription_addon_id' => $this->subscription_addon_id,
            'subscription_addon' => $this->whenLoaded('subscriptionAddon', fn () => $this->subscriptionAddon ? [
                'id' => $this->subscriptionAddon->id,
                'plan_name' => $this->subscriptionAddon->plan?->name,
                'status' => $this->subscriptionAddon->status,
                'sessions_total' => $this->subscriptionAddon->sessions_total,
                'sessions_remaining' => $this->subscriptionAddon->sessions_remaining,
            ] : null),
            'check_in_at' => $this->check_in_at?->toIso8601String(),
            'check_in_location' => [
                'latitude' => $this->check_in_latitude ? (float) $this->check_in_latitude : null,
                'longitude' => $this->check_in_longitude ? (float) $this->check_in_longitude : null,
                'accuracy_meters' => $this->check_in_accuracy_meters,
                'distance_meters' => $this->check_in_distance_meters,
                'status' => $this->check_in_location_status,
            ],
            'check_out_at' => $this->check_out_at?->toIso8601String(),
            'check_out_location' => [
                'latitude' => $this->check_out_latitude ? (float) $this->check_out_latitude : null,
                'longitude' => $this->check_out_longitude ? (float) $this->check_out_longitude : null,
                'accuracy_meters' => $this->check_out_accuracy_meters,
                'distance_meters' => $this->check_out_distance_meters,
                'status' => $this->check_out_location_status,
            ],
            'status' => $this->status,
            'scan_method' => $this->scan_method,
            'alert_reason' => $this->alert_reason,
            'notes' => $this->notes,
            'creator' => new UserSummaryResource($this->whenLoaded('creator')),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
