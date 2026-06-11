<?php

namespace App\Actions\Reports;

use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class EmployeePerformanceReport
{
    /**
     * Generate employee performance report(s).
     *
     * @param  array{from?: string|null, to?: string|null, employee_id?: int|null}  $params
     */
    public function execute(array $params): mixed
    {
        $from = $params['from'] ?? Carbon::now()->startOfMonth()->toDateString();
        $to = $params['to'] ?? Carbon::now()->endOfMonth()->toDateString();

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

        if (isset($params['employee_id'])) {
            $row = $query->where('employees.id', $params['employee_id'])->first();
            if ($row) {
                $row->commissions_earned = number_format((float) $row->commissions_earned, 2, '.', '');
                $row->sales_count = (int) $row->sales_count;
                $row->subscriptions_count = (int) $row->subscriptions_count;
            }

            return $row;
        }

        return $query->orderBy('employees.id', 'asc')
            ->cursorPaginate(15)->through(function ($item) {
                $item->commissions_earned = number_format((float) $item->commissions_earned, 2, '.', '');
                $item->sales_count = (int) $item->sales_count;
                $item->subscriptions_count = (int) $item->subscriptions_count;

                return $item;
            });
    }
}
