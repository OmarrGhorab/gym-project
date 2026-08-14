<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\WrapsApiResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PayslipResource extends JsonResource
{
    use WrapsApiResponse;

    public function toArray(Request $request): array
    {
        return [
            'employee' => [
                'id' => $this->employee_id,
                'name' => $this->employee?->name,
                'role' => $this->employee?->role,
            ],
            'month' => $this->month,
            'base_salary' => number_format((float) $this->base_salary, 2, '.', ''),
            'commissions' => CommissionResource::collection($this->whenLoaded('monthCommissions'))->resolve(),
            'commission_breakdown' => $this->whenLoaded(
                'commissionBreakdown',
                fn () => $this->commissionBreakdown->values()->all(),
                [],
            ),
            'attendance' => [
                'records_count' => $this->whenLoaded('monthAttendance', fn () => $this->monthAttendance->count(), 0),
                'late_count' => $this->whenLoaded('monthAttendance', fn () => $this->monthAttendance->where('status', 'late')->count(), 0),
                'absent_count' => $this->whenLoaded(
                    'absenceBreakdown',
                    fn () => $this->absenceBreakdown->count(),
                    0,
                ),
            ],
            'bonuses' => number_format((float) $this->bonuses, 2, '.', ''),
            'bonus_breakdown' => $this->whenLoaded(
                'bonusBreakdown',
                fn () => $this->bonusBreakdown->values()->all(),
                [],
            ),
            'deductions' => number_format((float) $this->deductions, 2, '.', ''),
            'absence_deductions' => number_format((float) $this->absence_deductions, 2, '.', ''),
            'total_deductions' => number_format(
                (float) $this->deductions + (float) $this->absence_deductions,
                2,
                '.',
                '',
            ),
            'absence_breakdown' => $this->whenLoaded(
                'absenceBreakdown',
                fn () => $this->absenceBreakdown->values()->all(),
                [],
            ),
            'manual_bonus_reason' => $this->manual_bonus_reason,
            'manual_deduction_reason' => $this->manual_deduction_reason,
            'net_salary' => number_format((float) $this->net_salary, 2, '.', ''),
            'generated_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
