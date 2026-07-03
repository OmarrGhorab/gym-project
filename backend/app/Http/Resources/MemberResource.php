<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\WrapsApiResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

final class MemberResource extends JsonResource
{
    use WrapsApiResponse;

    public function toArray(Request $request): array
    {
        $latestSubscription = $this->latestSubscription;

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
            ] : null,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
