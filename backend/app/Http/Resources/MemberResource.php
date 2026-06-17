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
        return [
            'id' => $this->id,
            'name' => $this->name,
            'phone' => $this->phone,
            'email' => $this->email,
            'gender' => $this->gender,
            'birth_date' => $this->birth_date?->toDateString(),
            'national_id' => $this->national_id,
            'join_date' => $this->join_date?->toDateString(),
            'status' => $this->status,
            'notes' => $this->notes,
            'has_photo' => (bool) $this->photo_path,
            'created_by' => $this->created_by,
            'total_paid' => bcadd((string) ($this->total_paid ?? '0.00'), '0.00', 2),
            'latest_subscription' => $this->latestSubscription ? [
                'id' => $this->latestSubscription->id,
                'plan_name' => $this->latestSubscription->plan?->name,
                'end_date' => $this->latestSubscription->end_date?->toDateString(),
                'status' => $this->latestSubscription->status,
            ] : null,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
