<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\WrapsApiResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class EmployeeAbsenceResource extends JsonResource
{
    use WrapsApiResponse;

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'employee' => [
                'id' => $this->employee_id,
                'name' => $this->employee?->name,
                'role' => $this->employee?->role,
                'status' => $this->employee?->status,
            ],
            'date' => $this->date?->toDateString(),
            'reason' => $this->absence_reason ?: $this->notes,
            'deduction_amount' => number_format((float) $this->absence_deduction_amount, 2, '.', ''),
            'recorded_by' => $this->absenceRecorder ? [
                'id' => $this->absenceRecorder->id,
                'name' => $this->absenceRecorder->name,
            ] : null,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
