<?php

namespace App\Actions\Reports;

use App\Models\Expense;
use App\Models\Payment;
use App\Models\Payroll;
use App\Models\Sale;
use App\Models\Subscription;
use App\Models\SubscriptionAddon;
use Carbon\Carbon;

final class FinanceDashboardSummary
{
    /**
     * @return array<string, mixed>
     */
    public function execute(array $params = []): array
    {
        $todayOnly = ($params['_today_only'] ?? false) === true;
        $from = Carbon::parse($params['from'] ?? now()->startOfMonth()->toDateString())->startOfDay();
        $to = Carbon::parse($params['to'] ?? now()->toDateString())->endOfDay();
        $groupBy = $params['group_by'] ?? 'month';
        $rangeDays = max($from->diffInDays($to) + 1, 1);
        $previousTo = $from->copy()->subDay()->endOfDay();
        $previousFrom = $previousTo->copy()->subDays($rangeDays - 1)->startOfDay();
        $chartStart = $groupBy === 'day' ? $from->copy() : $from->copy()->startOfMonth();

        $monthRevenue = $this->paidPaymentsTotal($from, $to);
        $previousMonthRevenue = $todayOnly ? 0.0 : $this->paidPaymentsTotal($previousFrom, $previousTo);
        $monthExpenses = $this->expensesTotal($from, $to);
        $previousMonthExpenses = $todayOnly ? 0.0 : $this->expensesTotal($previousFrom, $previousTo);
        $pendingPayroll = $todayOnly
            ? 0.0
            : (float) Payroll::query()->where('status', 'pending')->sum('net_salary');
        $outstandingDues = $todayOnly
            ? ['total' => 0.0, 'count' => 0, 'rows' => collect()]
            : $this->outstandingDues();
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
                'revenue_growth_rate' => $todayOnly ? '0.00' : $this->growthRate($monthRevenue, $previousMonthRevenue),
                'expense_growth_rate' => $todayOnly ? '0.00' : $this->growthRate($monthExpenses, $previousMonthExpenses),
            ],
            'revenue_sources' => $this->revenueSources($from, $to),
            'payment_methods' => $this->paymentMethods($from, $to),
            'chart' => $this->monthlyChart($chartStart, $to, $groupBy),
            'upcoming' => [
                'dues' => $outstandingDues['rows'],
                'pending_payroll' => $todayOnly
                    ? collect()
                    : Payroll::query()
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
                    ->whereBetween('date', [$from->copy()->startOfDay()->toDateTimeString(), $to->copy()->endOfDay()->toDateTimeString()])
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
            ->revenue()
            ->whereBetween('paid_at', [$from->toDateTimeString(), $to->toDateTimeString()])
            ->sum('amount');
    }

    private function paidPaymentsTotalForType(Carbon $from, Carbon $to, string $payableType): float
    {
        return $this->paidPaymentsTotalForTypes($from, $to, [$payableType]);
    }

    /**
     * @param  array<int, class-string>  $payableTypes
     */
    private function paidPaymentsTotalForTypes(Carbon $from, Carbon $to, array $payableTypes): float
    {
        return (float) Payment::query()
            ->revenue()
            ->whereIn('payable_type', $payableTypes)
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
        $metrics = app(MembershipMetrics::class);
        $totals = $metrics->outstandingDues();
        $rows = $metrics->duesQuery()->limit(4)->get();

        return [
            'total' => $totals['total'],
            'count' => $totals['count'],
            'rows' => $rows->map(fn (Subscription $subscription): array => [
                'id' => $subscription->id,
                'title' => $subscription->member?->name ?? 'Unknown member',
                'description' => ($subscription->plan?->name ?? 'Subscription').' due '.$subscription->end_date?->toDateString(),
                'amount' => $this->money($metrics->subscriptionBalance($subscription)),
            ])->values(),
        ];
    }

    /**
     * @return array<int, array{key: string, label: string, amount: string, percentage: string}>
     */
    private function revenueSources(Carbon $from, Carbon $to): array
    {
        $paidRevenue = $this->paidPaymentsTotal($from, $to);
        $subscriptionRevenue = $this->paidPaymentsTotalForTypes($from, $to, [Subscription::class, SubscriptionAddon::class]);
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
            ->revenue()
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
    private function monthlyChart(Carbon $from, Carbon $to, string $groupBy): array
    {
        $financial = app(FinancialReport::class)->execute([
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
            'group_by' => $groupBy === 'day' ? 'day' : 'month',
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
