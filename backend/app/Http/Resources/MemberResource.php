<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\WrapsApiResponse;
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
            'expiry_date' => $latestSubscription?->end_date?->toDateString(),
            'status' => $this->status,
            'membership_status' => $latestSubscription?->status,
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
            'latest_subscription' => $latestSubscription ? [
                'id' => $latestSubscription->id,
                'plan_name' => $latestSubscription->plan?->name,
                'start_date' => $latestSubscription->start_date?->toDateString(),
                'end_date' => $latestSubscription->end_date?->toDateString(),
                'status' => $latestSubscription->status,
                'price_paid' => $latestSubscriptionData['price_paid'] ?? '0.00',
                'paid_total' => $latestSubscriptionData['paid_total'] ?? '0.00',
                'balance' => $latestSubscriptionData['balance'] ?? '0.00',
                'package_price_paid' => $latestSubscriptionData['package_price_paid'] ?? '0.00',
                'package_paid_total' => $latestSubscriptionData['package_paid_total'] ?? '0.00',
                'package_balance' => $latestSubscriptionData['package_balance'] ?? '0.00',
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

        if ($payments->contains(fn ($payment): bool => in_array($payment->status, ['paid', 'partial'], true))) {
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
