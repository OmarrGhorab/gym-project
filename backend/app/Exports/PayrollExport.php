<?php

namespace App\Exports;

use App\Models\Payroll;
use Illuminate\Http\Request;
use Maatwebsite\Excel\Concerns\FromQuery;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

class PayrollExport implements FromQuery, WithHeadings, WithMapping
{
    protected array $filters;

    public function __construct(array $filters)
    {
        $this->filters = $filters;
    }

    public function query()
    {
        $query = Payroll::query()->with('employee');
        $customRequest = new Request(['filter' => $this->filters]);

        return QueryBuilder::for($query, $customRequest)
            ->allowedFilters([
                AllowedFilter::exact('month'),
                AllowedFilter::exact('status'),
                AllowedFilter::exact('employee_id'),
            ])
            ->latest();
    }

    public function headings(): array
    {
        return [
            'ID',
            'Employee Name',
            'Month',
            'Base Salary',
            'Commissions Total',
            'Bonuses',
            'Deductions',
            'Net Salary',
            'Status',
            'Paid At',
            'Created At',
        ];
    }

    public function map($row): array
    {
        return [
            $row->id,
            $row->employee?->name,
            $row->month,
            number_format($row->base_salary, 2, '.', ''),
            number_format($row->commissions_total, 2, '.', ''),
            number_format($row->bonuses, 2, '.', ''),
            number_format($row->deductions, 2, '.', ''),
            number_format($row->net_salary, 2, '.', ''),
            $row->status,
            $row->paid_at?->toDateTimeString(),
            $row->created_at?->toDateTimeString(),
        ];
    }
}
