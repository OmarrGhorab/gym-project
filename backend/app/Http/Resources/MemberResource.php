<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\WrapsApiResponse;
use App\Models\Payment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Carbon;

final class MemberResource extends JsonResource
{
    use WrapsApiResponse;

    public function toArray(Request $request): array
    {
        $latestSubscription = $this->latestSubscription;
        $latestSubscription?->loadMissing(['payments', 'addons.plan', 'addons.coach', 'addons.payments']);
        $latestSubscriptionResource = $latestSubscription ? new SubscriptionResource($latestSubscription) : null;
        $latestSubscriptionData = $latestSubscriptionResource?->toArray($request);

        return [
            'id' => $this->id,
            'name' => $this->name,
            'phone' => $this->phone,
            'email' => $this->email,
            'gender' => $this->gender,
            'national_id' => $this->when(
                $request->user()?->hasRole(['Admin', 'Manager']),
                $this->national_id,
            ),
            'emergency_contact_name' => $this->emergency_contact_name,
            'emergency_contact_phone' => $this->emergency_contact_phone,
            'attendance_code' => $this->attendance_code,
            'attendance_qr' => $this->attendance_code ? "member:{$this->attendance_code}" : null,
            'birth_date' => $this->birth_date?->toDateString(),
            'join_date' => $this->join_date?->toDateString(),
            'expiry_date' => $latestSubscriptionData['projected_end_date'] ?? $latestSubscription?->end_date?->toDateString(),
            'status' => $this->status,
            // The subscription resource already works out what the membership
            // really is right now — scheduled before its start date, expired
            // once the grace period has run out. Reading the raw column here
            // instead made a membership sold for next week show as "active" on
            // every screen built from the member payload.
            'membership_status' => $latestSubscriptionData['status'] ?? null,
            'billing_status' => $this->billingStatus(),
            'notes' => $this->notes,
            'goals' => $this->goals,
            'injuries' => $this->injuries,
            'medical_notes' => $this->medical_notes,
            'tags' => $this->tags ?? [],
            'coach_id' => $this->coach_id,
            'coach' => $this->whenLoaded('coach', fn () => [
                'id' => $this->coach?->id,
                'name' => $this->coach?->name,
                'role' => $this->coach?->role,
            ]),
            'has_photo' => (bool) $this->photo_path,
            'created_by' => $this->created_by,
            'total_paid' => bcadd((string) ($this->total_paid ?? '0.00'), '0.00', 2),
            'visits_this_month' => (int) ($this->visits_this_month ?? 0),
            'latest_subscription' => $latestSubscription ? [
                'id' => $latestSubscription->id,
                'plan_id' => $latestSubscription->plan_id,
                'plan_name' => $latestSubscription->plan?->name,
                'start_date' => $latestSubscription->start_date?->toDateString(),
                'end_date' => $latestSubscription->end_date?->toDateString(),
                'projected_end_date' => $latestSubscriptionData['projected_end_date'] ?? null,
                'status' => $latestSubscriptionData['status'] ?? $latestSubscription->status,
                'price_paid' => $latestSubscriptionData['price_paid'] ?? '0.00',
                'discount' => $latestSubscriptionData['discount'] ?? '0.00',
                'paid_total' => $latestSubscriptionData['paid_total'] ?? '0.00',
                'balance' => $latestSubscriptionData['balance'] ?? '0.00',
                'package_price_paid' => $latestSubscriptionData['package_price_paid'] ?? '0.00',
                'package_paid_total' => $latestSubscriptionData['package_paid_total'] ?? '0.00',
                'package_balance' => $latestSubscriptionData['package_balance'] ?? '0.00',
                'days_left' => $latestSubscriptionData['days_left'] ?? null,
                'freeze' => $latestSubscriptionData['freeze'] ?? null,
                'pending_freeze' => $latestSubscriptionData['pending_freeze'] ?? null,
                'renewal_health' => $latestSubscriptionData['renewal_health'] ?? null,
                'renewal_health_reason' => $latestSubscriptionData['renewal_health_reason'] ?? null,
                'cancellation_grace_days' => $latestSubscriptionData['cancellation_grace_days'] ?? 2,
                'sessions_total' => $latestSubscriptionData['sessions_total'] ?? $latestSubscription->sessions_total,
                'sessions_remaining' => $latestSubscriptionData['sessions_remaining'] ?? $latestSubscription->sessions_remaining,
                'can_cancel_with_refund' => $latestSubscriptionData['can_cancel_with_refund'] ?? false,
                'cancellation_grace_ends_on' => $latestSubscriptionData['cancellation_grace_ends_on'] ?? null,
                'default_refund_amount' => $latestSubscriptionData['default_refund_amount'] ?? null,
                'addons' => $latestSubscriptionData['addons'] ?? [],
            ] : null,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }

    private function billingStatus(): string
    {
        $latestSubscription = $this->latestSubscription;

        if (! $latestSubscription) {
            return 'trial';
        }

        $payments = $latestSubscription->payments;

        if ($payments->contains(fn ($payment): bool => in_array($payment->status, Payment::SETTLEMENT_STATUSES, true))) {
            return 'paid';
        }

        if ($payments->contains(fn ($payment): bool => ! in_array($payment->status, ['paid', 'partial'], true)
            && $payment->due_date !== null
            && $payment->due_date->lt(Carbon::today()))) {
            return 'overdue';
        }

        return 'pending';
    }
}
