<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\WrapsApiResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class OvertimeShiftResource extends JsonResource
{
    use WrapsApiResponse;

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'employee_id' => $this->employee_id,
            'employee' => $this->whenLoaded('employee', fn () => [
                'id' => $this->employee?->id,
                'name' => $this->employee?->name,
                'role' => $this->employee?->role,
            ]),
            'covering_for_employee_id' => $this->covering_for_employee_id,
            'covering_for' => $this->whenLoaded('coveringFor', fn () => $this->coveringFor ? [
                'id' => $this->coveringFor->id,
                'name' => $this->coveringFor->name,
                'role' => $this->coveringFor->role,
            ] : null),
            'employee_shift_id' => $this->employee_shift_id,
            'shift' => $this->whenLoaded('shift', fn () => $this->shift ? [
                'id' => $this->shift->id,
                'name' => $this->shift->name,
                'starts_at' => $this->shift->starts_at?->format('H:i'),
                'ends_at' => $this->shift->ends_at?->format('H:i'),
            ] : null),
            'date' => $this->date?->toDateString(),
            'starts_at' => $this->starts_at?->format('H:i'),
            'ends_at' => $this->ends_at?->format('H:i'),
            'hours' => $this->hours !== null ? number_format((float) $this->hours, 2, '.', '') : null,
            'bonus_amount' => number_format((float) $this->bonus_amount, 2, '.', ''),
            'status' => $this->status,
            'notes' => $this->notes,
            'reviewed_by' => $this->whenLoaded('reviewedBy', fn () => $this->reviewedBy ? [
                'id' => $this->reviewedBy->id,
                'name' => $this->reviewedBy->name,
            ] : null),
            'reviewed_at' => $this->reviewed_at?->toIso8601String(),
            'settled_at' => $this->settled_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
