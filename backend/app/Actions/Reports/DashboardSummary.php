<?php

namespace App\Actions\Reports;

use App\Actions\Dashboard\SalesTodayReport;
use App\Actions\Dashboard\TopProductsReport;
use App\Models\Member;
use App\Models\Payment;
use Carbon\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class DashboardSummary
{
    public function __construct(
        private readonly MembershipMetrics $metrics,
    ) {}

    /**
     * Get the dashboard summary (cached).
     *
     * @return array<string, mixed>
     */
    public function execute(): array
    {
        // Bump cache key when payload shape changes so clients never read stale fields.
        return Cache::remember('dashboard:summary:v3', 60, function () {
            $now = Carbon::now();
            $startOfMonth = $now->copy()->startOfMonth()->toDateTimeString();
            $endOfToday = $now->copy()->endOfDay()->toDateTimeString();
            $metrics = $this->metrics->snapshot($now);

            $previousRevenue = $this->metrics->paymentsTotalMtd(
                null,
                $now->copy()->subMonthNoOverflow()->startOfMonth()->toDateTimeString(),
                $now->copy()->subMonthNoOverflow()->endOfMonth()->toDateTimeString(),
            );

            $newMembersThisMonth = Member::query()
                ->whereBetween('created_at', [$startOfMonth, $endOfToday])
                ->count();
            $newMembersPreviousMonth = Member::query()
                ->whereBetween('created_at', [
                    $now->copy()->subMonthNoOverflow()->startOfMonth()->toDateTimeString(),
                    $now->copy()->subMonthNoOverflow()->endOfMonth()->toDateTimeString(),
                ])
                ->count();

            $salesTodayReport = app(SalesTodayReport::class)->execute();
            $topProducts = app(TopProductsReport::class)->execute(5, 'week');

            $currentMonth = $now->format('Y-m');
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
                'active_subscriptions' => $metrics['active_subscriptions'],
                'frozen_subscriptions' => $metrics['frozen_subscriptions'],
                'revenue_mtd' => $metrics['revenue_mtd'],
                'subscription_revenue_mtd' => $metrics['subscription_revenue_mtd'],
                'subscription_revenue_live' => $metrics['subscription_revenue_live'],
                'outstanding_dues_total' => $metrics['outstanding_dues_total'],
                'outstanding_dues_count' => $metrics['outstanding_dues_count'],
                'revenue_growth_rate' => $this->growthRate((float) $metrics['revenue_mtd'], $previousRevenue),
                'new_members_this_month' => $newMembersThisMonth,
                'new_members_previous_month' => $newMembersPreviousMonth,
                'new_members_growth_rate' => $this->growthRate($newMembersThisMonth, $newMembersPreviousMonth),
                'expiring_soon' => $metrics['expiring_soon'],
                'sales_today' => [
                    'count' => $salesTodayReport['count'],
                    'revenue' => $salesTodayReport['revenue'],
                ],
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
