<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\WrapsApiResponse;
use App\Models\Commission;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PayslipResource extends JsonResource
{
    use WrapsApiResponse;

    public function toArray(Request $request): array
    {
        // Fetch commissions matching the employee and month
        $commissions = Commission::where('employee_id', $this->employee_id)
            ->where('month', $this->month)
            ->get();

        return [
            'employee' => [
                'id' => $this->employee_id,
                'name' => $this->employee?->name,
                'role' => $this->employee?->role,
            ],
            'month' => $this->month,
            'base_salary' => number_format((float) $this->base_salary, 2, '.', ''),
            'commissions' => CommissionResource::collection($commissions)->resolve(),
            'bonuses' => number_format((float) $this->bonuses, 2, '.', ''),
            'deductions' => number_format((float) $this->deductions, 2, '.', ''),
            'net_salary' => number_format((float) $this->net_salary, 2, '.', ''),
            'generated_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
