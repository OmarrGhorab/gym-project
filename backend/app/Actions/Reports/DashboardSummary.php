<?php

namespace App\Actions\Reports;

use App\Actions\Dashboard\SalesTodayReport;
use App\Actions\Dashboard\TopProductsReport;
use App\Actions\Reminders\FindExpiringSubscriptions;
use App\Models\Member;
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
        return Cache::remember('dashboard:summary:v2', 60, function () {
            // 1. Active subscriptions count
            $activeSubscriptions = Subscription::query()
                ->where('status', 'active')
                ->count();

            // 2. Revenue MTD
            $now = Carbon::now();
            $startOfMonth = $now->copy()->startOfMonth()->toDateTimeString();
            $endOfToday = Carbon::now()->endOfDay()->toDateTimeString();
            $revenueMtd = DB::table('payments')
                ->where('status', 'paid')
                ->whereBetween('paid_at', [$startOfMonth, $endOfToday])
                ->sum('amount');
            $revenueMtdStr = number_format((float) $revenueMtd, 2, '.', '');
            $previousRevenue = DB::table('payments')
                ->where('status', 'paid')
                ->whereBetween('paid_at', [
                    $now->copy()->subMonthNoOverflow()->startOfMonth()->toDateTimeString(),
                    $now->copy()->subMonthNoOverflow()->endOfMonth()->toDateTimeString(),
                ])
                ->sum('amount');
            $revenueGrowthRate = $this->growthRate((float) $revenueMtd, (float) $previousRevenue);

            $newMembersThisMonth = Member::query()
                ->whereBetween('created_at', [$startOfMonth, $endOfToday])
                ->count();
            $newMembersPreviousMonth = Member::query()
                ->whereBetween('created_at', [
                    $now->copy()->subMonthNoOverflow()->startOfMonth()->toDateTimeString(),
                    $now->copy()->subMonthNoOverflow()->endOfMonth()->toDateTimeString(),
                ])
                ->count();
            $newMembersGrowthRate = $this->growthRate($newMembersThisMonth, $newMembersPreviousMonth);

            // 3. Expiring soon count
            $today = Carbon::today();
            $end = $today->copy()->addDays(app(FindExpiringSubscriptions::class)->reminderDays());
            $expiringSoon = Subscription::query()
                ->where('status', 'active')
                ->withoutLaterActiveRenewal()
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
                'revenue_growth_rate' => $revenueGrowthRate,
                'new_members_this_month' => $newMembersThisMonth,
                'new_members_previous_month' => $newMembersPreviousMonth,
                'new_members_growth_rate' => $newMembersGrowthRate,
                'expiring_soon' => $expiringSoon,
                'sales_today' => $salesTodayData,
                'top_products' => $topProducts,
                'captain_leaderboard' => $captainLeaderboard,
            ];
        });
    }

    private function growthRate(float|int $current, float|int $previous): string
    {
        if ((float) $previous === 0.0) {
            return (float) $current > 0.0 ? '100.00' : '0.00';
        }

        return number_format((((float) $current - (float) $previous) / (float) $previous) * 100, 2, '.', '');
    }
}
