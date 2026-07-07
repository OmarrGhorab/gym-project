<?php

namespace App\Actions\Reports;

use Carbon\Carbon;
use App\Models\Sale;
use App\Models\Subscription;
use Illuminate\Support\Facades\DB;

class FinancialReport
{
    /**
     * Generate the financial report.
     *
     * @param  array{from: string, to: string, group_by: string, revenue_source?: string|null}  $params
     * @return array{data: array<int, array{period: string, revenue: string, expenses: string, net_profit: string}>, meta: array{from: string, to: string, group_by: string, totals: array{revenue: string, expenses: string, net_profit: string}}}
     */
    public function execute(array $params): array
    {
        $from = $params['from'];
        $to = $params['to'];
        $groupBy = $params['group_by'];
        $revenueSource = $params['revenue_source'] ?? null;

        $startDate = Carbon::parse($from)->startOfDay()->toDateTimeString();
        $endDate = Carbon::parse($to)->endOfDay()->toDateTimeString();

        $isSqlite = DB::connection()->getDriverName() === 'sqlite';

        if ($groupBy === 'day') {
            $paymentGroup = $isSqlite ? 'strftime("%Y-%m-%d", paid_at)' : 'DATE(paid_at)';
            $expenseGroup = $isSqlite ? 'strftime("%Y-%m-%d", date)' : 'DATE(date)';
        } else {
            $paymentGroup = $isSqlite ? 'strftime("%Y-%m", paid_at)' : 'DATE_FORMAT(paid_at, "%Y-%m")';
            $expenseGroup = $isSqlite ? 'strftime("%Y-%m", date)' : 'DATE_FORMAT(date, "%Y-%m")';
        }

        // Aggregate revenue (paid payments)
        $revenueQuery = DB::table('payments')
            ->whereIn('status', ['paid', 'partial'])
            ->whereBetween('paid_at', [$startDate, $endDate])
            ->when($revenueSource === 'subscriptions', fn ($query) => $query->where('payable_type', Subscription::class))
            ->when($revenueSource === 'sales', fn ($query) => $query->where('payable_type', Sale::class))
            ->groupBy(DB::raw($paymentGroup))
            ->selectRaw(DB::raw($paymentGroup.' as period'))
            ->selectRaw('SUM(amount) as total_revenue')
            ->get()
            ->pluck('total_revenue', 'period')
            ->toArray();

        // Aggregate expenses
        $expenseQuery = DB::table('expenses')
            ->whereBetween('date', [$startDate, $endDate])
            ->groupBy(DB::raw($expenseGroup))
            ->selectRaw(DB::raw($expenseGroup.' as period'))
            ->selectRaw('SUM(amount) as total_expenses')
            ->get()
            ->pluck('total_expenses', 'period')
            ->toArray();

        // Generate periods range
        $periods = [];
        if ($groupBy === 'day') {
            $current = Carbon::parse($from);
            $end = Carbon::parse($to);
            while ($current->lessThanOrEqualTo($end)) {
                $periods[] = $current->toDateString();
                $current->addDay();
            }
        } else {
            $current = Carbon::parse($from)->startOfMonth();
            $end = Carbon::parse($to)->startOfMonth();
            while ($current->lessThanOrEqualTo($end)) {
                $periods[] = $current->format('Y-m');
                $current->addMonth();
            }
        }

        $data = [];
        $totals = [
            'revenue' => '0.00',
            'expenses' => '0.00',
            'net_profit' => '0.00',
        ];

        foreach ($periods as $period) {
            $revenue = $revenueQuery[$period] ?? 0;
            $expense = $expenseQuery[$period] ?? 0;

            $revenueStr = number_format((float) $revenue, 2, '.', '');
            $expenseStr = number_format((float) $expense, 2, '.', '');
            $netProfitStr = bcsub($revenueStr, $expenseStr, 2);

            $data[] = [
                'period' => $period,
                'revenue' => $revenueStr,
                'expenses' => $expenseStr,
                'net_profit' => $netProfitStr,
            ];

            $totals['revenue'] = bcadd($totals['revenue'], $revenueStr, 2);
            $totals['expenses'] = bcadd($totals['expenses'], $expenseStr, 2);
            $totals['net_profit'] = bcadd($totals['net_profit'], $netProfitStr, 2);
        }

        return [
            'data' => $data,
            'meta' => [
                'from' => $from,
                'to' => $to,
                'group_by' => $groupBy,
                'revenue_source' => $revenueSource,
                'totals' => $totals,
            ],
        ];
    }
}
