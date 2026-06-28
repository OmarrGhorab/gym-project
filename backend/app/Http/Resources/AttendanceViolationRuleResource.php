<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\WrapsApiResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AttendanceViolationRuleResource extends JsonResource
{
    use WrapsApiResponse;

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'code' => $this->code,
            'name' => $this->name,
            'description' => $this->description,
            'threshold_minutes' => $this->threshold_minutes,
            'deduction_days' => number_format((float) $this->deduction_days, 2, '.', ''),
            'requires_admin_approval' => (bool) $this->requires_admin_approval,
            'auto_apply_if_unreviewed' => (bool) $this->auto_apply_if_unreviewed,
            'is_active' => (bool) $this->is_active,
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
