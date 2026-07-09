<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\WrapsApiResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class EmployeeResource extends JsonResource
{
    use WrapsApiResponse;

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'phone' => $this->phone,
            'attendance_code' => $this->attendance_code,
            'attendance_qr' => $this->attendance_code ? "employee:{$this->attendance_code}" : null,
            'role' => $this->role,
            'base_salary' => number_format((float) $this->base_salary, 2, '.', ''),
            'pay_day' => $this->pay_day,
            'shift_id' => $this->shift_id,
            'shift' => new EmployeeShiftResource($this->whenLoaded('shift')),
            'hire_date' => $this->hire_date?->toDateString(),
            'status' => $this->status,
            'user_id' => $this->user_id,
            'user' => new UserSummaryResource($this->whenLoaded('user')),
            'plan_commission_rules' => EmployeePlanCommissionRuleResource::collection(
                $this->whenLoaded('planCommissionRules')
            ),
            'commissions_summary' => $this->when(isset($this->commissions_summary), $this->commissions_summary),
            'performance_summary' => $this->when(isset($this->performance_summary), $this->performance_summary),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
