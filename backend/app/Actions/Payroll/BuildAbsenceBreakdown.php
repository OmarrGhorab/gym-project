<?php

namespace App\Actions\Payroll;

use App\Models\Attendance;
use Illuminate\Support\Carbon;

final class BuildAbsenceBreakdown
{
    /**
     * Build the admin-entered absence rows and their payroll deduction total.
     *
     * @return array{deductions: string, rows: array<int, array<string, mixed>>}
     */
    public function execute(int $employeeId, string $month): array
    {
        $from = "{$month}-01";
        $to = Carbon::parse($from)->endOfMonth()->toDateString();

        $rows = Attendance::query()
            ->with('absenceRecorder:id,name')
            ->where('employee_id', $employeeId)
            ->where('status', 'absent')
            ->whereBetween('date', [$from, $to])
            ->orderBy('date')
            ->orderBy('id')
            ->get()
            ->map(function (Attendance $absence): array {
                $reason = trim((string) ($absence->absence_reason ?: $absence->notes));

                return [
                    'attendance_id' => $absence->id,
                    'date' => $absence->date?->toDateString(),
                    'reason' => $reason,
                    'deduction_amount' => $this->money($absence->absence_deduction_amount),
                    'recorded_by' => $absence->absenceRecorder?->name,
                ];
            })
            ->values()
            ->all();

        $deductions = array_reduce(
            $rows,
            static fn (string $total, array $row): string => bcadd($total, (string) $row['deduction_amount'], 2),
            '0.00',
        );

        return [
            'deductions' => $deductions,
            'rows' => $rows,
        ];
    }

    private function money(mixed $value): string
    {
        return number_format((float) $value, 2, '.', '');
    }
}
