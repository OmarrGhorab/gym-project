<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\WrapsApiResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class EmployeePlanCommissionRuleResource extends JsonResource
{
    use WrapsApiResponse;

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'employee_id' => $this->employee_id,
            'plan_id' => $this->plan_id,
            'employee' => $this->whenLoaded('employee', fn () => [
                'id' => $this->employee?->id,
                'name' => $this->employee?->name,
                'role' => $this->employee?->role,
            ]),
            'plan' => $this->whenLoaded('plan', fn () => [
                'id' => $this->plan?->id,
                'name' => $this->plan?->name,
                'price' => $this->plan?->price,
            ]),
            'calculation_type' => $this->calculation_type,
            'value' => number_format((float) $this->value, 4, '.', ''),
            'is_active' => (bool) $this->is_active,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
