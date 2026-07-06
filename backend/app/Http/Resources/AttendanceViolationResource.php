<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\WrapsApiResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AttendanceViolationResource extends JsonResource
{
    use WrapsApiResponse;

    public function toArray(Request $request): array
    {
        $estimatedDeductionAmount = null;

        if ($this->relationLoaded('employee') && $this->employee?->base_salary !== null) {
            $dailySalary = bcdiv((string) $this->employee->base_salary, '30', 2);
            $estimatedDeductionAmount = bcmul($dailySalary, (string) $this->deduction_days, 2);
        }

        return [
            'id' => $this->id,
            'employee_id' => $this->employee_id,
            'employee' => $this->whenLoaded('employee', fn () => [
                'id' => $this->employee->id,
                'name' => $this->employee->name,
                'role' => $this->employee->role,
            ]),
            'attendance_id' => $this->attendance_id,
            'rule' => $this->whenLoaded('rule', fn () => [
                'id' => $this->rule?->id,
                'code' => $this->rule?->code,
                'name' => $this->rule?->name,
                'description' => $this->rule?->description,
            ]),
            'payroll_id' => $this->payroll_id,
            'violation_date' => $this->violation_date?->toDateString(),
            'type' => $this->type,
            'minutes' => $this->minutes,
            'deduction_days' => number_format((float) $this->deduction_days, 2, '.', ''),
            'deduction_amount' => number_format((float) $this->deduction_amount, 2, '.', ''),
            'estimated_deduction_amount' => $estimatedDeductionAmount !== null
                ? number_format((float) $estimatedDeductionAmount, 2, '.', '')
                : null,
            'status' => $this->status,
            'notes' => $this->notes,
            'reviewed_at' => $this->reviewed_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
