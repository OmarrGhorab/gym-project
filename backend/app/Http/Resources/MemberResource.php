<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\WrapsApiResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Shapes the Member API response.
 *
 * Dues totals would use withSum('payments','amount') aggregate (M2) once the
 * payments table exists. Until then, total_paid defaults to 0.
 */
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
            // Dues aggregate: 0 until payments table is available (graceful degradation).
            'total_paid' => 0,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
