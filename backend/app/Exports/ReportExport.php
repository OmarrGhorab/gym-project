<?php

namespace App\Exports;

use App\Actions\Reports\FinancialReport;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;

class ReportExport implements FromCollection, WithHeadings, WithMapping
{
    protected array $filters;

    public function __construct(array $filters)
    {
        $this->filters = $filters;
    }

    public function collection()
    {
        $type = $this->filters['type'] ?? 'financial';

        if ($type === 'financial') {
            $from = $this->filters['from'] ?? Carbon::now()->startOfMonth()->toDateString();
            $to = $this->filters['to'] ?? Carbon::now()->endOfMonth()->toDateString();
            $groupBy = $this->filters['group_by'] ?? 'month';

            $report = app(FinancialReport::class)->execute([
                'from' => $from,
                'to' => $to,
                'group_by' => $groupBy,
            ]);

            return collect($report['data']);
        }

        // Employee performance report (unpaginated)
        $from = $this->filters['from'] ?? Carbon::now()->startOfMonth()->toDateString();
        $to = $this->filters['to'] ?? Carbon::now()->endOfMonth()->toDateString();

        $startDate = Carbon::parse($from)->startOfDay()->toDateTimeString();
        $endDate = Carbon::parse($to)->endOfDay()->toDateTimeString();

        $query = DB::table('employees')
            ->join('users', 'employees.user_id', '=', 'users.id')
            ->leftJoinSub(
                DB::table('sales')
                    ->select('sold_by_user_id', DB::raw('COUNT(*) as sales_count'))
                    ->whereBetween('created_at', [$startDate, $endDate])
                    ->groupBy('sold_by_user_id'),
                's',
                'employees.user_id',
                '=',
                's.sold_by_user_id'
            )
            ->leftJoinSub(
                DB::table('subscriptions')
                    ->select('sold_by_user_id', DB::raw('COUNT(*) as subscriptions_count'))
                    ->whereBetween('created_at', [$startDate, $endDate])
                    ->groupBy('sold_by_user_id'),
                'sub',
                'employees.user_id',
                '=',
                'sub.sold_by_user_id'
            )
            ->leftJoinSub(
                DB::table('commissions')
                    ->select('employee_id', DB::raw('SUM(amount) as commissions_earned'))
                    ->whereBetween('created_at', [$startDate, $endDate])
                    ->groupBy('employee_id'),
                'c',
                'employees.id',
                '=',
                'c.employee_id'
            )
            ->select([
                'employees.id as employee_id',
                'users.name',
                'employees.role',
                DB::raw('COALESCE(s.sales_count, 0) as sales_count'),
                DB::raw('COALESCE(sub.subscriptions_count, 0) as subscriptions_count'),
                DB::raw('COALESCE(c.commissions_earned, 0.00) as commissions_earned'),
            ]);

        if (isset($this->filters['employee_id'])) {
            $query->where('employees.id', $this->filters['employee_id']);
        }

        return $query->orderBy('employees.id', 'asc')->get();
    }

    public function headings(): array
    {
        $type = $this->filters['type'] ?? 'financial';

        if ($type === 'financial') {
            return [
                'Period',
                'Revenue',
                'Expenses',
                'Net Profit',
            ];
        }

        return [
            'Employee ID',
            'Name',
            'Role',
            'Sales Count',
            'Subscriptions Count',
            'Commissions Earned',
        ];
    }

    public function map($row): array
    {
        $type = $this->filters['type'] ?? 'financial';

        if ($type === 'financial') {
            return [
                $row['period'],
                number_format((float) $row['revenue'], 2, '.', ''),
                number_format((float) $row['expenses'], 2, '.', ''),
                number_format((float) $row['net_profit'], 2, '.', ''),
            ];
        }

        return [
            $row->employee_id,
            $row->name,
            $row->role,
            (int) $row->sales_count,
            (int) $row->subscriptions_count,
            number_format((float) $row->commissions_earned, 2, '.', ''),
        ];
    }
}
