<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\WrapsApiResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class EmployeeShiftResource extends JsonResource
{
    use WrapsApiResponse;

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'starts_at' => $this->starts_at?->format('H:i'),
            'ends_at' => $this->ends_at?->format('H:i'),
            'grace_minutes' => (int) $this->grace_minutes,
            'off_days' => array_map('intval', $this->off_days ?? []),
            'off_day_bonus_enabled' => (bool) $this->off_day_bonus_enabled,
            'off_day_bonus_amount' => number_format((float) $this->off_day_bonus_amount, 2, '.', ''),
            'is_active' => (bool) $this->is_active,
            'off_rotation' => $this->whenLoaded('offRotation', function () {
                if (! $this->offRotation) {
                    return null;
                }

                return [
                    'id' => $this->offRotation->id,
                    'off_weekday' => (int) $this->offRotation->off_weekday,
                    'rotation_start_date' => $this->offRotation->rotation_start_date?->toDateString(),
                    'employee_order' => array_map('intval', $this->offRotation->employee_order ?? []),
                    'is_active' => (bool) $this->offRotation->is_active,
                ];
            }),
        ];
    }
}
