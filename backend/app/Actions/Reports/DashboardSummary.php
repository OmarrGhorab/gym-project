<?php

namespace App\Actions\Reports;

use App\Actions\Dashboard\SalesTodayReport;
use App\Actions\Dashboard\TopProductsReport;
use App\Actions\Reminders\FindExpiringSubscriptions;
use App\Models\Subscription;
use Carbon\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class DashboardSummary
{
    /**
     * Get the dashboard summary (cached).
     *
     * @return array<string, mixed>
     */
    public function execute(): array
    {
        return Cache::remember('dashboard:summary:v1', 60, function () {
            // 1. Active subscriptions count
            $activeSubscriptions = Subscription::query()
                ->where('status', 'active')
                ->count();

            // 2. Revenue MTD
            $startOfMonth = Carbon::now()->startOfMonth()->toDateTimeString();
            $endOfToday = Carbon::now()->endOfDay()->toDateTimeString();
            $revenueMtd = DB::table('payments')
                ->where('status', 'paid')
                ->whereBetween('paid_at', [$startOfMonth, $endOfToday])
                ->sum('amount');
            $revenueMtdStr = number_format((float) $revenueMtd, 2, '.', '');

            // 3. Expiring soon count
            $today = Carbon::today();
            $end = $today->copy()->addDays(app(FindExpiringSubscriptions::class)->reminderDays());
            $expiringSoon = Subscription::query()
                ->where('status', 'active')
                ->whereBetween('end_date', [$today->toDateString(), $end->toDateString()])
                ->count();

            // 4. Sales today (reuse shared action)
            $salesTodayReport = app(SalesTodayReport::class)->execute();
            $salesTodayData = [
                'count' => $salesTodayReport['count'],
                'revenue' => $salesTodayReport['revenue'],
            ];

            // 5. Top products (week) (reuse shared action)
            $topProducts = app(TopProductsReport::class)->execute(5, 'week');

            // 6. Captain leaderboard
            $currentMonth = Carbon::now()->format('Y-m');
            $captainLeaderboard = DB::table('commissions')
                ->join('employees', 'commissions.employee_id', '=', 'employees.id')
                ->join('users', 'employees.user_id', '=', 'users.id')
                ->where('commissions.month', $currentMonth)
                ->groupBy('commissions.employee_id', 'users.name')
                ->select([
                    'commissions.employee_id',
                    'users.name',
                    DB::raw('SUM(commissions.amount) as commissions_total'),
                ])
                ->orderByDesc('commissions_total')
                ->get()
                ->map(function ($row) {
                    $row->commissions_total = number_format((float) $row->commissions_total, 2, '.', '');

                    return $row;
                })
                ->toArray();

            return [
                'active_subscriptions' => $activeSubscriptions,
                'revenue_mtd' => $revenueMtdStr,
                'expiring_soon' => $expiringSoon,
                'sales_today' => $salesTodayData,
                'top_products' => $topProducts,
                'captain_leaderboard' => $captainLeaderboard,
            ];
        });
    }
}
