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
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

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

        // The timeline buckets are startOfMonth/endOfMonth for group_by=month, so they can extend
        // outside [$from, $to]. Widen the window for the bucketed queries so no row a bucket used to
        // count gets dropped. The full-range totals above keep the un-widened range.
        $qFrom = $groupBy === 'month' ? $from->copy()->startOfMonth() : $from;
        $qTo = $groupBy === 'month' ? $to->copy()->endOfMonth() : $to;

        $isSqlite = DB::connection()->getDriverName() === 'sqlite';

        $bucketExpr = function (string $column) use ($groupBy, $isSqlite): string {
            if ($groupBy === 'month') {
                return $isSqlite ? 'strftime("%Y-%m", '.$column.')' : 'DATE_FORMAT('.$column.', "%Y-%m")';
            }

            return $isSqlite ? 'strftime("%Y-%m-%d", '.$column.')' : 'DATE('.$column.')';
        };

        /**
         * @param  Builder<covariant \Illuminate\Database\Eloquent\Model>  $query
         * @return Collection<array-key, mixed>
         */
        $bucketTotals = function ($query, string $expr, string $aggregate) {
            return $query
                ->toBase()
                ->groupBy(DB::raw($expr))
                ->selectRaw($expr.' as bucket, '.$aggregate.' as total')
                ->get()
                ->pluck('total', 'bucket');
        };

        $paidAtBucket = $bucketExpr('paid_at');

        $subIncomeByBucket = $bucketTotals(
            Payment::query()
                ->revenue()
                ->whereIn('payable_type', [Subscription::class, SubscriptionAddon::class])
                ->whereBetween('paid_at', [$qFrom, $qTo]),
            $paidAtBucket,
            'SUM(amount)'
        );

        $posIncomeByBucket = $bucketTotals(
            Payment::query()
                ->revenue()
                ->where('payable_type', Sale::class)
                ->whereBetween('paid_at', [$qFrom, $qTo]),
            $paidAtBucket,
            'SUM(amount)'
        );

        $otherIncomeByBucket = $bucketTotals(
            Payment::query()
                ->revenue()
                ->whereNotIn('payable_type', [Subscription::class, SubscriptionAddon::class, Sale::class])
                ->whereBetween('paid_at', [$qFrom, $qTo]),
            $paidAtBucket,
            'SUM(amount)'
        );

        $expensesByBucket = $bucketTotals(
            Expense::query()
                ->whereBetween('date', [$qFrom->toDateString(), $qTo->toDateString()]),
            $bucketExpr('date'),
            'SUM(amount)'
        );

        $payrollByBucket = $bucketTotals(
            Payroll::query()
                ->where('status', 'paid')
                ->whereBetween('paid_at', [$qFrom, $qTo]),
            $paidAtBucket,
            'SUM(net_salary)'
        );

        $refundsByBucket = $bucketTotals(
            SubscriptionRefund::query()
                ->whereBetween('refunded_at', [$qFrom, $qTo]),
            $bucketExpr('refunded_at'),
            'SUM(amount)'
        );

        foreach ($period as $date) {
            $periodStart = $groupBy === 'month' ? $date->copy()->startOfMonth() : $date->copy()->startOfDay();

            if ($periodStart->gt($to)) {
                break;
            }

            $bucketKey = $groupBy === 'month' ? $date->format('Y-m') : $date->format('Y-m-d');

            $daySubIncome = (float) ($subIncomeByBucket[$bucketKey] ?? 0);

            $dayPosIncome = (float) ($posIncomeByBucket[$bucketKey] ?? 0);

            $dayOtherIncome = (float) ($otherIncomeByBucket[$bucketKey] ?? 0);

            $dayIncome = $daySubIncome + $dayPosIncome + $dayOtherIncome;

            $dayExpenses = (float) ($expensesByBucket[$bucketKey] ?? 0);

            $dayPayroll = (float) ($payrollByBucket[$bucketKey] ?? 0);

            $dayRefunds = (float) ($refundsByBucket[$bucketKey] ?? 0);

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
