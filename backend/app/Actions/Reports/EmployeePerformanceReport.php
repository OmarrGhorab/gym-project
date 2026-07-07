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
        $periodStart = Carbon::parse($from)->startOfDay();
        $periodEnd = Carbon::parse($to)->endOfDay();
        $periodDays = max(1, (int) $periodStart->diffInDays($periodEnd) + 1);
        $previousEnd = $periodStart->copy()->subSecond();
        $previousStart = $previousEnd->copy()->subDays($periodDays - 1)->startOfDay();

        $query = DB::table('employees')
            ->leftJoin('users', 'employees.user_id', '=', 'users.id')
            ->leftJoinSub(
                DB::table('sales')
                    ->select('sold_by_user_id', DB::raw('COUNT(*) as sales_count'), DB::raw('SUM(total) as sales_volume'))
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
                DB::table('subscription_addons')
                    ->select('coach_id', DB::raw('COUNT(*) as coached_services_count'), DB::raw('SUM(price_paid) as coached_services_revenue'))
                    ->whereBetween('created_at', [$startDate, $endDate])
                    ->groupBy('coach_id'),
                'sa',
                'employees.id',
                '=',
                'sa.coach_id'
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
            ->leftJoinSub(
                DB::table('attendance')
                    ->select('employee_id', DB::raw('COUNT(*) as attendance_count'))
                    ->whereBetween('date', [$from, $to])
                    ->whereIn('status', ['present', 'late'])
                    ->groupBy('employee_id'),
                'a',
                'employees.id',
                '=',
                'a.employee_id'
            )
            ->leftJoinSub(
                DB::table('sales')
                    ->select('sold_by_user_id', DB::raw('COUNT(*) as previous_sales_count'), DB::raw('SUM(total) as previous_sales_volume'))
                    ->whereBetween('created_at', [$previousStart->toDateTimeString(), $previousEnd->toDateTimeString()])
                    ->groupBy('sold_by_user_id'),
                'ps',
                'employees.user_id',
                '=',
                'ps.sold_by_user_id'
            )
            ->leftJoinSub(
                DB::table('subscriptions')
                    ->select('sold_by_user_id', DB::raw('COUNT(*) as previous_subscriptions_count'))
                    ->whereBetween('created_at', [$previousStart->toDateTimeString(), $previousEnd->toDateTimeString()])
                    ->groupBy('sold_by_user_id'),
                'psub',
                'employees.user_id',
                '=',
                'psub.sold_by_user_id'
            )
            ->leftJoinSub(
                DB::table('subscription_addons')
                    ->select('coach_id', DB::raw('COUNT(*) as previous_coached_services_count'), DB::raw('SUM(price_paid) as previous_coached_services_revenue'))
                    ->whereBetween('created_at', [$previousStart->toDateTimeString(), $previousEnd->toDateTimeString()])
                    ->groupBy('coach_id'),
                'psa',
                'employees.id',
                '=',
                'psa.coach_id'
            )
            ->leftJoinSub(
                DB::table('commissions')
                    ->select('employee_id', DB::raw('SUM(amount) as previous_commissions_earned'))
                    ->whereBetween('created_at', [$previousStart->toDateTimeString(), $previousEnd->toDateTimeString()])
                    ->groupBy('employee_id'),
                'pc',
                'employees.id',
                '=',
                'pc.employee_id'
            )
            ->select([
                'employees.id as employee_id',
                DB::raw('COALESCE(users.name, employees.name) as name'),
                'employees.role',
                DB::raw('COALESCE(s.sales_count, 0) as sales_count'),
                DB::raw('COALESCE(s.sales_volume, 0.00) as sales_volume'),
                DB::raw('COALESCE(sub.subscriptions_count, 0) as subscriptions_count'),
                DB::raw('COALESCE(sa.coached_services_count, 0) as coached_services_count'),
                DB::raw('COALESCE(sa.coached_services_revenue, 0.00) as coached_services_revenue'),
                DB::raw('COALESCE(c.commissions_earned, 0.00) as commissions_earned'),
                DB::raw('COALESCE(a.attendance_count, 0) as attendance_count'),
                DB::raw('COALESCE(ps.previous_sales_count, 0) as previous_sales_count'),
                DB::raw('COALESCE(ps.previous_sales_volume, 0.00) as previous_sales_volume'),
                DB::raw('COALESCE(psub.previous_subscriptions_count, 0) as previous_subscriptions_count'),
                DB::raw('COALESCE(psa.previous_coached_services_count, 0) as previous_coached_services_count'),
                DB::raw('COALESCE(psa.previous_coached_services_revenue, 0.00) as previous_coached_services_revenue'),
                DB::raw('COALESCE(pc.previous_commissions_earned, 0.00) as previous_commissions_earned'),
            ]);

        if (isset($params['employee_id'])) {
            $row = $query->where('employees.id', $params['employee_id'])->first();
            if ($row) {
                $this->formatRow($row);
            }

            return $row;
        }

        return $query->orderBy('employees.id', 'asc')
            ->cursorPaginate(15)->through(function ($item) {
                $this->formatRow($item);

                return $item;
            });
    }

    private function formatRow(object $row): void
    {
        $row->commissions_earned = number_format((float) $row->commissions_earned, 2, '.', '');
        $row->sales_volume = number_format((float) $row->sales_volume, 2, '.', '');
        $row->coached_services_revenue = number_format((float) $row->coached_services_revenue, 2, '.', '');
        $row->previous_sales_volume = number_format((float) $row->previous_sales_volume, 2, '.', '');
        $row->previous_coached_services_revenue = number_format((float) $row->previous_coached_services_revenue, 2, '.', '');
        $row->previous_commissions_earned = number_format((float) $row->previous_commissions_earned, 2, '.', '');
        $row->sales_count = (int) $row->sales_count;
        $row->subscriptions_count = (int) $row->subscriptions_count;
        $row->coached_services_count = (int) $row->coached_services_count;
        $row->attendance_count = (int) $row->attendance_count;
        $row->previous_sales_count = (int) $row->previous_sales_count;
        $row->previous_subscriptions_count = (int) $row->previous_subscriptions_count;
        $row->previous_coached_services_count = (int) $row->previous_coached_services_count;
        $row->comparison = [
            'sales_count_delta' => $row->sales_count - $row->previous_sales_count,
            'subscriptions_count_delta' => $row->subscriptions_count - $row->previous_subscriptions_count,
            'coached_services_count_delta' => $row->coached_services_count - $row->previous_coached_services_count,
            'commissions_delta' => number_format((float) $row->commissions_earned - (float) $row->previous_commissions_earned, 2, '.', ''),
            'sales_volume_delta' => number_format((float) $row->sales_volume - (float) $row->previous_sales_volume, 2, '.', ''),
            'coached_services_revenue_delta' => number_format((float) $row->coached_services_revenue - (float) $row->previous_coached_services_revenue, 2, '.', ''),
        ];
    }
}
