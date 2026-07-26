<?php

namespace App\Actions\Overtime;

use App\Models\OvertimeShift;
use Illuminate\Support\Carbon;

/**
 * Per-employee overtime totals for a payroll month, so an admin can see
 * exactly how much still has to be typed into each salary by hand.
 */
class SummarizeOvertimeShifts
{
    /**
     * @return list<array<string, mixed>>
     */
    public function handle(string $month): array
    {
        $from = Carbon::parse($month.'-01')->startOfMonth()->toDateString();
        $to = Carbon::parse($from)->endOfMonth()->toDateString();

        return OvertimeShift::query()
            ->with('employee:id,name,role')
            ->whereBetween('date', [$from, $to])
            ->whereIn('status', [
                OvertimeShift::STATUS_PENDING,
                OvertimeShift::STATUS_APPROVED,
                OvertimeShift::STATUS_SETTLED,
            ])
            ->get()
            ->groupBy('employee_id')
            ->map(function ($rows, $employeeId) use ($month): array {
                $employee = $rows->first()->employee;
                $approved = $rows->where('status', OvertimeShift::STATUS_APPROVED);
                $settled = $rows->where('status', OvertimeShift::STATUS_SETTLED);

                return [
                    'employee_id' => (int) $employeeId,
                    'employee_name' => $employee?->name,
                    'employee_role' => $employee?->role,
                    'month' => $month,
                    'shifts_count' => $rows->count(),
                    'pending_count' => $rows->where('status', OvertimeShift::STATUS_PENDING)->count(),
                    'approved_count' => $approved->count(),
                    'settled_count' => $settled->count(),
                    'hours_total' => number_format((float) $rows->sum('hours'), 2, '.', ''),
                    // Approved but not yet typed into the salary.
                    'approved_amount' => number_format((float) $approved->sum('bonus_amount'), 2, '.', ''),
                    'settled_amount' => number_format((float) $settled->sum('bonus_amount'), 2, '.', ''),
                ];
            })
            ->sortByDesc('approved_amount')
            ->values()
            ->all();
    }
}
