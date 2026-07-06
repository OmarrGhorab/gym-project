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
        ];
    }
}
