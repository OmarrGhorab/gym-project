<?php

namespace App\Http\Resources;

use App\Models\PlanCategory;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin PlanCategory
 */
final class PlanCategoryResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'plan_scope' => $this->plan_scope,
            'plan_type' => $this->plan_type,
            'description' => $this->description,
            'is_active' => $this->is_active,
            'is_system' => $this->isSystem(),
            'plans_count' => $this->whenCounted('plans'),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
