<?php

namespace App\Exports;

use App\Models\Attendance;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Maatwebsite\Excel\Concerns\FromQuery;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

class AttendanceExport implements FromQuery, WithHeadings, WithMapping
{
    public function __construct(private readonly array $filters) {}

    public function query()
    {
        $query = Attendance::query()->with(['employee', 'shift']);
        $customRequest = new Request(['filter' => $this->normalizedFilters()]);

        return QueryBuilder::for($query, $customRequest)
            ->allowedFilters(
                AllowedFilter::exact('employee_id'),
                AllowedFilter::exact('date'),
                AllowedFilter::exact('status'),
                AllowedFilter::callback('month', function ($query, string $value): void {
                    $query->whereBetween('date', ["{$value}-01", Carbon::parse("{$value}-01")->endOfMonth()->toDateString()]);
                }),
            )
            ->allowedSorts('date', 'check_in', 'created_at')
            ->defaultSort('date');
    }

    public function headings(): array
    {
        return [
            'ID',
            'Employee',
            'Role',
            'Shift',
            'Date',
            'Check In',
            'Check Out',
            'Status',
            'Schedule Status',
            'Approval Status',
            'Late Minutes',
            'Early Leave Minutes',
            'Scan Method',
            'Check In GPS',
            'Check Out GPS',
            'Notes',
        ];
    }

    public function map($row): array
    {
        return [
            $row->id,
            $row->employee?->name,
            $row->employee?->role,
            $row->shift?->name,
            $row->date?->toDateString(),
            $row->check_in?->format('H:i'),
            $row->check_out?->format('H:i'),
            $row->status,
            $row->schedule_status,
            $row->approval_status,
            (int) $row->late_minutes,
            (int) $row->early_leave_minutes,
            $row->scan_method,
            $row->check_in_location_status,
            $row->check_out_location_status,
            $row->notes,
        ];
    }

    private function normalizedFilters(): array
    {
        if (($this->filters['period'] ?? null) === 'monthly' && isset($this->filters['month'])) {
            return ['month' => $this->filters['month']];
        }

        if (isset($this->filters['date'])) {
            return ['date' => $this->filters['date']];
        }

        return $this->filters;
    }
}
