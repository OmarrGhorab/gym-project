<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\WrapsApiResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PayrollResource extends JsonResource
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
                'pay_day' => $this->employee?->pay_day,
            ],
            'month' => $this->month,
            'base_salary' => number_format((float) $this->base_salary, 2, '.', ''),
            'commissions_total' => number_format((float) $this->commissions_total, 2, '.', ''),
            'bonuses' => number_format((float) $this->bonuses, 2, '.', ''),
            'deductions' => number_format((float) $this->deductions, 2, '.', ''),
            'attendance_deductions' => number_format((float) $this->attendance_deductions, 2, '.', ''),
            'attendance_snapshot' => $this->attendance_snapshot,
            'net_salary' => number_format((float) $this->net_salary, 2, '.', ''),
            'status' => $this->status,
            'paid_at' => $this->paid_at?->toIso8601String(),
        ];
    }
}
