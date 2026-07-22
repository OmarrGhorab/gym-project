<?php

namespace App\Actions\Reports;

use App\Models\Expense;
use App\Models\Payment;
use App\Models\Payroll;
use App\Models\Sale;
use App\Models\Subscription;
use App\Models\SubscriptionAddon;
use App\Models\SubscriptionRefund;
use Carbon\Carbon;
use Carbon\CarbonPeriod;

final class IncomeOutcomeReport
{
    /**
     * @param  array<string, mixed>  $params
     * @return array<string, mixed>
     */
    public function execute(array $params = []): array
    {
        $from = Carbon::parse($params['from'] ?? now()->subDays(30)->toDateString())->startOfDay();
        $to = Carbon::parse($params['to'] ?? now()->toDateString())->endOfDay();
        $groupBy = $params['group_by'] ?? 'day';

        $totalSubIncome = (float) Payment::query()
            ->revenue()
            ->whereIn('payable_type', [Subscription::class, SubscriptionAddon::class])
            ->whereBetween('paid_at', [$from, $to])
            ->sum('amount');

        $totalPosIncome = (float) Payment::query()
            ->revenue()
            ->where('payable_type', Sale::class)
            ->whereBetween('paid_at', [$from, $to])
            ->sum('amount');

        $totalOtherIncome = (float) Payment::query()
            ->revenue()
            ->whereNotIn('payable_type', [Subscription::class, SubscriptionAddon::class, Sale::class])
            ->whereBetween('paid_at', [$from, $to])
            ->sum('amount');

        $totalIncome = $totalSubIncome + $totalPosIncome + $totalOtherIncome;

        $totalExpenses = (float) Expense::query()
            ->whereBetween('date', [$from->toDateString(), $to->toDateString()])
            ->sum('amount');

        $totalPayrollPaid = (float) Payroll::query()
            ->where('status', 'paid')
            ->whereBetween('paid_at', [$from, $to])
            ->sum('net_salary');

        $totalRefunds = (float) SubscriptionRefund::query()
            ->whereBetween('refunded_at', [$from, $to])
            ->sum('amount');

        $totalOutcome = $totalExpenses + $totalPayrollPaid + $totalRefunds;
        $netProfit = $totalIncome - $totalOutcome;
        $profitMargin = $totalIncome > 0 ? ($netProfit / $totalIncome) * 100 : 0.0;

        $timeline = [];
        $period = CarbonPeriod::create($from, $groupBy === 'month' ? '1 month' : '1 day', $to);

        foreach ($period as $date) {
            $periodStart = $groupBy === 'month' ? $date->copy()->startOfMonth() : $date->copy()->startOfDay();
            $periodEnd = $groupBy === 'month' ? $date->copy()->endOfMonth() : $date->copy()->endOfDay();

            if ($periodStart->gt($to)) {
                break;
            }

            $daySubIncome = (float) Payment::query()
                ->revenue()
                ->whereIn('payable_type', [Subscription::class, SubscriptionAddon::class])
                ->whereBetween('paid_at', [$periodStart, $periodEnd])
                ->sum('amount');

            $dayPosIncome = (float) Payment::query()
                ->revenue()
                ->where('payable_type', Sale::class)
                ->whereBetween('paid_at', [$periodStart, $periodEnd])
                ->sum('amount');

            $dayOtherIncome = (float) Payment::query()
                ->revenue()
                ->whereNotIn('payable_type', [Subscription::class, SubscriptionAddon::class, Sale::class])
                ->whereBetween('paid_at', [$periodStart, $periodEnd])
                ->sum('amount');

            $dayIncome = $daySubIncome + $dayPosIncome + $dayOtherIncome;

            $dayExpenses = (float) Expense::query()
                ->whereBetween('date', [$periodStart->toDateString(), $periodEnd->toDateString()])
                ->sum('amount');

            $dayPayroll = (float) Payroll::query()
                ->where('status', 'paid')
                ->whereBetween('paid_at', [$periodStart, $periodEnd])
                ->sum('net_salary');

            $dayRefunds = (float) SubscriptionRefund::query()
                ->whereBetween('refunded_at', [$periodStart, $periodEnd])
                ->sum('amount');

            $dayOutcome = $dayExpenses + $dayPayroll + $dayRefunds;
            $dayNet = $dayIncome - $dayOutcome;

            $timeline[] = [
                'period' => $groupBy === 'month' ? $date->format('Y-m') : $date->format('Y-m-d'),
                'subscription_income' => number_format($daySubIncome, 2, '.', ''),
                'pos_income' => number_format($dayPosIncome, 2, '.', ''),
                'other_income' => number_format($dayOtherIncome, 2, '.', ''),
                'total_income' => number_format($dayIncome, 2, '.', ''),
                'expenses_outcome' => number_format($dayExpenses, 2, '.', ''),
                'payroll_outcome' => number_format($dayPayroll, 2, '.', ''),
                'refunds_outcome' => number_format($dayRefunds, 2, '.', ''),
                'total_outcome' => number_format($dayOutcome, 2, '.', ''),
                'net_profit' => number_format($dayNet, 2, '.', ''),
            ];
        }

        return [
            'totals' => [
                'subscription_income' => number_format($totalSubIncome, 2, '.', ''),
                'pos_income' => number_format($totalPosIncome, 2, '.', ''),
                'other_income' => number_format($totalOtherIncome, 2, '.', ''),
                'total_income' => number_format($totalIncome, 2, '.', ''),
                'expenses_outcome' => number_format($totalExpenses, 2, '.', ''),
                'payroll_outcome' => number_format($totalPayrollPaid, 2, '.', ''),
                'refunds_outcome' => number_format($totalRefunds, 2, '.', ''),
                'total_outcome' => number_format($totalOutcome, 2, '.', ''),
                'net_profit' => number_format($netProfit, 2, '.', ''),
                'profit_margin' => number_format($profitMargin, 2, '.', ''),
            ],
            'timeline' => array_reverse($timeline),
        ];
    }
}
