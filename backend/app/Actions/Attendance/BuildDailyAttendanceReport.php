<?php

namespace App\Actions\Attendance;

use App\Models\Attendance;
use App\Models\Employee;
use ArPHP\I18N\Arabic;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * The day's staff attendance, one row per active employee.
 *
 * Employees who never scanned are still listed as "no scan" — a missing row is
 * the single most useful thing on this sheet, so it must not be an absence of
 * data the reader has to notice on their own.
 */
final class BuildDailyAttendanceReport
{
    /**
     * @return array{
     *   business_date: string,
     *   rows: Collection<int, array<string, mixed>>,
     *   totals: array<string, int>
     * }
     */
    public function data(Carbon $businessDate): array
    {
        $date = $businessDate->toDateString();

        $employees = Employee::query()
            ->active()
            ->with('shift')
            ->orderBy('name')
            ->get();

        $attendance = Attendance::query()
            ->with('shift')
            ->whereDate('date', $date)
            ->get()
            ->keyBy('employee_id');

        $rows = $employees->map(function (Employee $employee) use ($attendance): array {
            $record = $attendance->get($employee->id);

            return [
                'employee_id' => $employee->id,
                'employee' => $employee->name,
                'role' => $employee->role,
                'shift' => $record?->shift?->name ?? $employee->shift?->name ?? '-',
                'check_in' => $record?->check_in?->format('H:i') ?? '-',
                'check_out' => $record?->check_out?->format('H:i') ?? '-',
                'hours' => $this->workedHours($record),
                'status' => $record?->status ?? 'no_scan',
                'notes' => $record?->notes,
            ];
        });

        return [
            'business_date' => $date,
            'rows' => $rows,
            'totals' => [
                'employees_count' => $employees->count(),
                'records_count' => $attendance->count(),
                'present_count' => $attendance->where('status', 'present')->count(),
                'absent_count' => $attendance->where('status', 'absent')->count(),
                'still_in_count' => $attendance->filter(
                    fn (Attendance $row): bool => $row->check_in !== null && $row->check_out === null,
                )->count(),
                'no_scan_count' => max(0, $employees->count() - $attendance->count()),
            ],
        ];
    }

    /** Worked time as H:MM, or a dash while the day is still open. */
    private function workedHours(?Attendance $record): string
    {
        if ($record?->check_in === null || $record?->check_out === null) {
            return '-';
        }

        $in = Carbon::parse($record->date->toDateString().' '.$record->check_in->format('H:i'));
        $out = Carbon::parse($record->date->toDateString().' '.$record->check_out->format('H:i'));

        // A night shift signs out on the following calendar day.
        if ($out->lessThan($in)) {
            $out->addDay();
        }

        $minutes = (int) $in->diffInMinutes($out);

        return sprintf('%d:%02d', intdiv($minutes, 60), $minutes % 60);
    }

    public function pdf(Carbon $businessDate): string
    {
        $report = $this->data($businessDate);
        $arabic = new Arabic;

        $pdf = Pdf::loadView('reports.daily-attendance-pdf', [
            'pdfArabic' => static fn (?string $text): string => $text !== null && $text !== ''
                ? $arabic->utf8Glyphs($text, 120, false, true)
                : '',
            'report' => $report,
        ])->setPaper('a4', 'landscape')
            ->setOption('defaultFont', 'DejaVu Sans')
            ->setOption('isHtml5ParserEnabled', true);

        return $pdf->output();
    }

    public function filename(Carbon $businessDate): string
    {
        return "daily-attendance-{$businessDate->toDateString()}.pdf";
    }

    public function storagePath(Carbon $businessDate): string
    {
        return 'attendance-reports/'.$this->filename($businessDate);
    }
}
