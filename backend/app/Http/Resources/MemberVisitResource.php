<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\WrapsApiResponse;
use App\Models\Subscription;
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
                // Only counted when the index query asks for it (withCount); other
                // endpoints return the visit without the aggregate.
                'visits_this_month' => $this->member->visits_this_month === null
                    ? null
                    : (int) $this->member->visits_this_month,
            ]),
            // The plan the visit is read against. A blocked or pending-review visit has no
            // subscription of its own, so fall back to the member's latest one — the day
            // sheet still needs to show which membership the person is on.
            'plan_name' => $this->planSummary()?->plan?->name,
            'plan_status' => $this->planSummary()?->status,
            'plan_start_date' => $this->planSummary()?->start_date?->toDateString(),
            'plan_end_date' => $this->planSummary()?->end_date?->toDateString(),
            // Null means unlimited, so these have to come from the same summary the
            // plan name does: read off a visit with no subscription of its own, a
            // missing number is indistinguishable from an unlimited plan.
            'plan_sessions_remaining' => $this->planSummary()?->sessions_remaining,
            'plan_sessions_total' => $this->planSummary()?->sessions_total,
            'subscription_id' => $this->subscription_id,
            'subscription' => $this->whenLoaded('subscription', fn () => [
                'id' => $this->subscription?->id,
                'plan_name' => $this->subscription?->plan?->name,
                'status' => $this->subscription?->status,
                'start_date' => $this->subscription?->start_date?->toDateString(),
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
            'reviewed_at' => $this->reviewed_at?->toIso8601String(),
            'reviewed_by' => $this->reviewed_by,
            'creator' => new UserSummaryResource($this->whenLoaded('creator')),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }

    /**
     * The subscription whose plan describes this visit: the one it consumed, or the
     * member's latest when the visit never resolved to one. Returns null rather than
     * lazy-loading, so a caller that did not eager-load cannot trigger N+1.
     */
    private function planSummary(): ?Subscription
    {
        if ($this->relationLoaded('subscription') && $this->subscription !== null) {
            return $this->subscription;
        }

        if ($this->relationLoaded('member') && $this->member?->relationLoaded('latestSubscription')) {
            return $this->member->latestSubscription;
        }

        return null;
    }
}
