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
            'absence_deductions' => number_format((float) $this->absence_deductions, 2, '.', ''),
            'total_deductions' => number_format(
                (float) $this->deductions + (float) $this->absence_deductions,
                2,
                '.',
                '',
            ),
            'absence_count' => count($this->absence_snapshot ?? []),
            'absence_breakdown' => $this->absence_snapshot ?? [],
            'manual_bonus_reason' => $this->manual_bonus_reason,
            'manual_deduction_reason' => $this->manual_deduction_reason,
            'net_salary' => number_format((float) $this->net_salary, 2, '.', ''),
            'status' => $this->status,
            'paid_at' => $this->paid_at?->toIso8601String(),
        ];
    }
}
