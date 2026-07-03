<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\WrapsApiResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

final class PlanResource extends JsonResource
{
    use WrapsApiResponse;

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'description' => $this->description,
            'price' => $this->price,
            'duration_days' => $this->duration_days,
            'sessions_count' => $this->sessions_count,
            'is_unlimited_sessions' => $this->is_unlimited_sessions,
            'type' => $this->type,
            'category' => $this->category,
            'is_active' => $this->is_active,
            'valid_from' => $this->valid_from?->toDateString(),
            'valid_to' => $this->valid_to?->toDateString(),
            'access_starts_at' => $this->access_starts_at,
            'access_ends_at' => $this->access_ends_at,
            'max_freeze_days' => $this->max_freeze_days,
            'min_freeze_days' => $this->min_freeze_days,
            'freeze_requires_approval' => $this->freeze_requires_approval,
            'is_sellable' => $this->isSellable(),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
