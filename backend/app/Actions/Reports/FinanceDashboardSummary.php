<?php

namespace App\Actions\Reports;

use App\Models\Expense;
use App\Models\Payment;
use App\Models\Payroll;
use App\Models\Sale;
use App\Models\Subscription;
use Carbon\Carbon;

final class FinanceDashboardSummary
{
    /**
     * @return array<string, mixed>
     */
    public function execute(): array
    {
        $now = Carbon::now();
        $monthStart = $now->copy()->startOfMonth();
        $monthEnd = $now->copy()->endOfDay();
        $previousMonthStart = $now->copy()->subMonthNoOverflow()->startOfMonth();
        $previousMonthEnd = $now->copy()->subMonthNoOverflow()->endOfMonth();
        $yearStart = $now->copy()->subMonthsNoOverflow(11)->startOfMonth();

        $monthRevenue = $this->paidPaymentsTotal($monthStart, $monthEnd);
        $previousMonthRevenue = $this->paidPaymentsTotal($previousMonthStart, $previousMonthEnd);
        $monthExpenses = $this->expensesTotal($monthStart, $monthEnd);
        $previousMonthExpenses = $this->expensesTotal($previousMonthStart, $previousMonthEnd);
        $pendingPayroll = (float) Payroll::query()
            ->where('status', 'pending')
            ->sum('net_salary');
        $outstandingDues = $this->outstandingDues();
        $netProfit = $monthRevenue - $monthExpenses - $pendingPayroll;
        $profitMargin = $monthRevenue > 0 ? ($netProfit / $monthRevenue) * 100 : 0.0;

        return [
            'totals' => [
                'revenue_mtd' => $this->money($monthRevenue),
                'previous_revenue_mtd' => $this->money($previousMonthRevenue),
                'expenses_mtd' => $this->money($monthExpenses),
                'previous_expenses_mtd' => $this->money($previousMonthExpenses),
                'pending_payroll' => $this->money($pendingPayroll),
                'outstanding_dues' => $this->money($outstandingDues['total']),
                'outstanding_dues_count' => $outstandingDues['count'],
                'net_profit_mtd' => $this->money($netProfit),
                'profit_margin' => number_format($profitMargin, 2, '.', ''),
                'revenue_growth_rate' => $this->growthRate($monthRevenue, $previousMonthRevenue),
                'expense_growth_rate' => $this->growthRate($monthExpenses, $previousMonthExpenses),
            ],
            'revenue_sources' => $this->revenueSources($monthStart, $monthEnd),
            'payment_methods' => $this->paymentMethods($monthStart, $monthEnd),
            'chart' => $this->monthlyChart($yearStart, $now),
            'upcoming' => [
                'dues' => $outstandingDues['rows'],
                'pending_payroll' => Payroll::query()
                    ->with('employee')
                    ->where('status', 'pending')
                    ->latest()
                    ->limit(3)
                    ->get()
                    ->map(fn (Payroll $payroll): array => [
                        'id' => $payroll->id,
                        'title' => ($payroll->employee?->name ?? 'Employee').' payroll',
                        'description' => $payroll->month,
                        'amount' => $this->money((float) $payroll->net_salary),
                    ])
                    ->values(),
                'recent_expenses' => Expense::query()
                    ->latest('date')
                    ->limit(3)
                    ->get()
                    ->map(fn (Expense $expense): array => [
                        'id' => $expense->id,
                        'title' => $expense->category,
                        'description' => $expense->date?->toDateString(),
                        'amount' => $this->money((float) $expense->amount),
                    ])
                    ->values(),
            ],
        ];
    }

    private function paidPaymentsTotal(Carbon $from, Carbon $to): float
    {
        return (float) Payment::query()
            ->where('status', 'paid')
            ->whereBetween('paid_at', [$from->toDateTimeString(), $to->toDateTimeString()])
            ->sum('amount');
    }

    private function paidPaymentsTotalForType(Carbon $from, Carbon $to, string $payableType): float
    {
        return (float) Payment::query()
            ->where('status', 'paid')
            ->where('payable_type', $payableType)
            ->whereBetween('paid_at', [$from->toDateTimeString(), $to->toDateTimeString()])
            ->sum('amount');
    }

    private function expensesTotal(Carbon $from, Carbon $to): float
    {
        return (float) Expense::query()
            ->whereBetween('date', [$from->copy()->startOfDay()->toDateTimeString(), $to->copy()->endOfDay()->toDateTimeString()])
            ->sum('amount');
    }

    /**
     * @return array{total: float, count: int, rows: mixed}
     */
    private function outstandingDues(): array
    {
        $paidTotals = Payment::query()
            ->selectRaw('payable_id, SUM(amount) as paid_total')
            ->where('payable_type', Subscription::class)
            ->groupBy('payable_id');

        $rows = Subscription::query()
            ->with(['member', 'plan'])
            ->leftJoinSub($paidTotals, 'paid_totals', 'paid_totals.payable_id', '=', 'subscriptions.id')
            ->select('subscriptions.*')
            ->selectRaw('COALESCE(paid_totals.paid_total, 0) as paid_total')
            ->whereRaw('subscriptions.price_paid > COALESCE(paid_totals.paid_total, 0)')
            ->orderBy('end_date')
            ->limit(4)
            ->get();

        $allDues = Subscription::query()
            ->leftJoinSub($paidTotals, 'paid_totals', 'paid_totals.payable_id', '=', 'subscriptions.id')
            ->select('subscriptions.*')
            ->selectRaw('COALESCE(paid_totals.paid_total, 0) as paid_total')
            ->whereRaw('subscriptions.price_paid > COALESCE(paid_totals.paid_total, 0)')
            ->get();

        $total = $allDues->sum(fn (Subscription $subscription): float => (float) $subscription->price_paid - (float) ($subscription->paid_total ?? 0));

        return [
            'total' => $total,
            'count' => $allDues->count(),
            'rows' => $rows->map(fn (Subscription $subscription): array => [
                'id' => $subscription->id,
                'title' => $subscription->member?->name ?? 'Unknown member',
                'description' => ($subscription->plan?->name ?? 'Subscription').' due '.$subscription->end_date?->toDateString(),
                'amount' => $this->money((float) $subscription->price_paid - (float) ($subscription->paid_total ?? 0)),
            ])->values(),
        ];
    }

    /**
     * @return array<int, array{key: string, label: string, amount: string, percentage: string}>
     */
    private function revenueSources(Carbon $from, Carbon $to): array
    {
        $paidRevenue = $this->paidPaymentsTotal($from, $to);
        $subscriptionRevenue = $this->paidPaymentsTotalForType($from, $to, Subscription::class);
        $posRevenue = $this->paidPaymentsTotalForType($from, $to, Sale::class);
        $otherRevenue = max($paidRevenue - $subscriptionRevenue - $posRevenue, 0);
        $total = max($paidRevenue, 1);

        return collect([
            ['key' => 'subscriptions', 'label' => 'Subscription payments', 'amount' => $subscriptionRevenue],
            ['key' => 'pos', 'label' => 'POS product sales', 'amount' => $posRevenue],
            ['key' => 'other', 'label' => 'Other payments', 'amount' => $otherRevenue],
        ])->map(fn (array $source): array => [
            'key' => $source['key'],
            'label' => $source['label'],
            'amount' => $this->money((float) $source['amount']),
            'percentage' => number_format(((float) $source['amount'] / $total) * 100, 1, '.', ''),
        ])->all();
    }

    /**
     * @return array<int, array{key: string, label: string, amount: string, percentage: string}>
     */
    private function paymentMethods(Carbon $from, Carbon $to): array
    {
        $rows = Payment::query()
            ->where('status', 'paid')
            ->whereBetween('paid_at', [$from->toDateTimeString(), $to->toDateTimeString()])
            ->selectRaw('method, SUM(amount) as total')
            ->groupBy('method')
            ->pluck('total', 'method');
        $total = max((float) $rows->sum(), 1);

        return collect(['cash' => 'Cash', 'card' => 'Card', 'bank_transfer' => 'Bank transfer'])
            ->map(fn (string $label, string $method): array => [
                'key' => $method,
                'label' => $label,
                'amount' => $this->money((float) ($rows[$method] ?? 0)),
                'percentage' => number_format(((float) ($rows[$method] ?? 0) / $total) * 100, 1, '.', ''),
            ])
            ->values()
            ->all();
    }

    /**
     * @return array<int, array{period: string, revenue: string, expenses: string, net_profit: string}>
     */
    private function monthlyChart(Carbon $from, Carbon $to): array
    {
        $financial = app(FinancialReport::class)->execute([
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
            'group_by' => 'month',
        ]);

        return $financial['data'];
    }

    private function growthRate(float $current, float $previous): string
    {
        if ($previous === 0.0) {
            return $current > 0.0 ? '100.00' : '0.00';
        }

        return number_format((($current - $previous) / $previous) * 100, 2, '.', '');
    }

    private function money(float $amount): string
    {
        return number_format($amount, 2, '.', '');
    }
}
