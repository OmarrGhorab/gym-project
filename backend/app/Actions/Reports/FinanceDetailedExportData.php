<?php

namespace App\Actions\Reports;

use App\Models\Employee;
use App\Models\EmployeeShift;
use App\Models\Expense;
use App\Models\Payment;
use App\Models\Payroll;
use App\Models\Sale;
use App\Models\Subscription;
use App\Models\SubscriptionAddon;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class FinanceDetailedExportData
{
    /** @var array<string, array<string, string>> */
    private array $translationCache = [];

    /**
     * @param  array{from?: string, to?: string, group_by?: string|null}  $filters
     * @return array<string, mixed>
     */
    public function build(array $filters, string $locale = 'en'): array
    {
        $from = Carbon::parse($filters['from'] ?? now()->startOfYear()->toDateString())->startOfDay();
        $to = Carbon::parse($filters['to'] ?? now()->toDateString())->endOfDay();

        $subscriptions = Subscription::query()
            ->with(['member:id,name', 'plan:id,name,category,type', 'soldBy.employee.shift', 'creator.employee.shift', 'payments'])
            ->whereBetween('created_at', [$from->toDateTimeString(), $to->toDateTimeString()])
            ->orderBy('created_at')
            ->get();

        $addons = SubscriptionAddon::query()
            ->with(['member:id,name', 'plan:id,name,category,type', 'coach:id,name', 'soldBy.employee.shift', 'creator.employee.shift', 'payments'])
            ->whereBetween('created_at', [$from->toDateTimeString(), $to->toDateTimeString()])
            ->orderBy('created_at')
            ->get();

        $sales = Sale::query()
            ->with(['member:id,name', 'soldBy.employee.shift', 'items.product:id,name', 'payment'])
            ->whereBetween('created_at', [$from->toDateTimeString(), $to->toDateTimeString()])
            ->orderBy('created_at')
            ->get();

        $payments = Payment::query()
            ->with(['creator.employee.shift', 'payable' => fn ($morphTo) => $morphTo->morphWith([
                Sale::class => ['items.product:id,name', 'member:id,name'],
                Subscription::class => ['plan:id,name', 'member:id,name'],
                SubscriptionAddon::class => ['plan:id,name', 'member:id,name'],
            ])])
            ->whereBetween('paid_at', [$from->toDateTimeString(), $to->toDateTimeString()])
            ->orderBy('paid_at')
            ->get();

        $expenses = Expense::query()
            ->with('creator.employee.shift')
            ->whereBetween('date', [$from->toDateString(), $to->toDateString()])
            ->orderBy('date')
            ->get();

        $payroll = Payroll::query()
            ->with('employee:id,name,role,base_salary,pay_day,status')
            ->whereBetween('month', [$from->format('Y-m'), $to->format('Y-m')])
            ->orderBy('month')
            ->get();

        $employees = Employee::query()
            ->with('shift:id,name')
            ->orderBy('name')
            ->get();

        $shifts = EmployeeShift::query()
            ->with(['employees' => fn ($query) => $query->active()->orderBy('name')])
            ->where('is_active', true)
            ->orderBy('starts_at')
            ->get();

        $dues = $this->buildDuesRows($locale);
        $shiftTransactions = $this->buildShiftTransactionRows(
            subscriptions: $subscriptions,
            addons: $addons,
            sales: $sales,
            expenses: $expenses,
            payments: $payments,
            shifts: $shifts,
            from: $from,
            to: $to,
            locale: $locale,
        );
        $shiftSummary = $this->buildShiftSummaryRows($shiftTransactions, $locale);

        $subscriptionRevenueCollected = $this->sumPaymentsForModel($subscriptions);
        $addonRevenueCollected = $this->sumPaymentsForModel($addons);
        $posRevenueCollected = $sales
            ->map(fn (Sale $sale): float => (float) ($sale->payment?->amount ?? 0))
            ->sum();
        $otherRevenueCollected = $payments
            ->filter(fn (Payment $payment): bool => ! in_array($payment->payable_type, [Subscription::class, SubscriptionAddon::class, Sale::class], true))
            ->sum(fn (Payment $payment): float => (float) $payment->amount);
        $expensesTotal = $expenses->sum(fn (Expense $expense): float => (float) $expense->amount);
        $pendingPayrollTotal = $payroll
            ->where('status', 'pending')
            ->sum(fn (Payroll $row): float => (float) $row->net_salary);
        $paidPayrollTotal = $payroll
            ->where('status', 'paid')
            ->sum(fn (Payroll $row): float => (float) $row->net_salary);
        $salarySnapshotTotal = $employees->sum(fn (Employee $employee): float => (float) $employee->base_salary);
        $bookedSubscriptionsTotal = $subscriptions->sum(fn (Subscription $subscription): float => (float) $subscription->price_paid);
        $bookedAddonsTotal = $addons->sum(fn (SubscriptionAddon $addon): float => (float) $addon->price_paid);
        $salesGrossTotal = $sales
            ->where('status', 'completed')
            ->sum(fn (Sale $sale): float => (float) $sale->total);
        $collectedRevenueTotal = $subscriptionRevenueCollected + $addonRevenueCollected + $posRevenueCollected + $otherRevenueCollected;
        $outstandingDuesTotal = collect($dues)->sum(fn (array $row): float => (float) $row['balance']);

        return [
            'meta' => [
                'from' => $from->toDateString(),
                'to' => $to->toDateString(),
                'generated_at' => now()->toDateTimeString(),
                'locale' => $locale,
            ],
            'summary' => [
                'collected_revenue_total' => $collectedRevenueTotal,
                'subscription_revenue_collected' => $subscriptionRevenueCollected,
                'addon_revenue_collected' => $addonRevenueCollected,
                'pos_revenue_collected' => $posRevenueCollected,
                'other_revenue_collected' => $otherRevenueCollected,
                'booked_subscriptions_total' => $bookedSubscriptionsTotal,
                'booked_addons_total' => $bookedAddonsTotal,
                'pos_gross_sales_total' => $salesGrossTotal,
                'expenses_total' => $expensesTotal,
                'pending_payroll_total' => $pendingPayrollTotal,
                'paid_payroll_total' => $paidPayrollTotal,
                'salary_snapshot_total' => $salarySnapshotTotal,
                'outstanding_dues_total' => $outstandingDuesTotal,
                'net_profit_after_expenses' => $collectedRevenueTotal - $expensesTotal - $pendingPayrollTotal,
                'subscriptions_count' => $subscriptions->count(),
                'addons_count' => $addons->count(),
                'sales_count' => $sales->count(),
                'payments_count' => $payments->count(),
                'expenses_count' => $expenses->count(),
                'payroll_count' => $payroll->count(),
                'employees_count' => $employees->count(),
                'shift_transactions_count' => count($shiftTransactions),
            ],
            'subscriptions' => $subscriptions->map(function (Subscription $subscription) use ($locale): array {
                $paymentsTotal = $subscription->payments->sum(fn (Payment $payment): float => (float) $payment->amount);

                return [
                    'sold_at' => $this->dateTime($subscription->created_at),
                    'subscription_id' => $subscription->id,
                    'member' => $subscription->member?->name ?? $this->t('unknown_member', $locale),
                    'plan' => $subscription->plan?->name ?? $this->t('unknown_plan', $locale),
                    'category' => $this->normalizeLabel($subscription->plan?->category, $locale),
                    'type' => $this->normalizeLabel($subscription->plan?->type, $locale),
                    'start_date' => $this->date($subscription->start_date),
                    'end_date' => $this->date($subscription->end_date),
                    'status' => $this->normalizeLabel($subscription->status, $locale),
                    'booked_price' => (float) $subscription->price_paid,
                    'discount' => (float) $subscription->discount,
                    'collected' => $paymentsTotal,
                    'balance' => max((float) $subscription->price_paid - $paymentsTotal, 0),
                    'sold_by' => $subscription->soldBy?->name ?? '',
                ];
            })->all(),
            'addons' => $addons->map(function (SubscriptionAddon $addon) use ($locale): array {
                $paymentsTotal = $addon->payments->sum(fn (Payment $payment): float => (float) $payment->amount);

                return [
                    'sold_at' => $this->dateTime($addon->created_at),
                    'addon_id' => $addon->id,
                    'subscription_id' => $addon->subscription_id,
                    'member' => $addon->member?->name ?? $this->t('unknown_member', $locale),
                    'service' => $addon->plan?->name ?? $this->t('unknown_addon', $locale),
                    'category' => $this->normalizeLabel($addon->plan?->category, $locale),
                    'type' => $this->normalizeLabel($addon->plan?->type, $locale),
                    'coach' => $addon->coach?->name ?? '',
                    'start_date' => $this->date($addon->start_date),
                    'end_date' => $this->date($addon->end_date),
                    'status' => $this->normalizeLabel($addon->status, $locale),
                    'booked_price' => (float) $addon->price_paid,
                    'discount' => (float) $addon->discount,
                    'collected' => $paymentsTotal,
                    'balance' => max((float) $addon->price_paid - $paymentsTotal, 0),
                ];
            })->all(),
            'sales' => $sales->map(function (Sale $sale) use ($locale): array {
                return [
                    'sold_at' => $this->dateTime($sale->created_at),
                    'sale_id' => $sale->id,
                    'member' => $sale->member?->name ?? $this->t('walk_in', $locale),
                    'seller' => $sale->soldBy?->name ?? '',
                    'items' => $sale->items->map(fn ($item): string => ($item->product?->name ?? $this->t('product', $locale)).' x'.$item->quantity)->join(', '),
                    'subtotal' => (float) $sale->subtotal,
                    'discount' => (float) $sale->discount,
                    'total' => (float) $sale->total,
                    'payment_method' => $this->normalizeLabel($sale->payment_method, $locale),
                    'status' => $this->normalizeLabel($sale->status, $locale),
                ];
            })->all(),
            'payments' => $payments->map(function (Payment $payment) use ($locale): array {
                return [
                    'paid_at' => $this->dateTime($payment->paid_at),
                    'payment_id' => $payment->id,
                    'source' => $this->paymentSourceLabel($payment, $locale),
                    'item' => $this->paymentItemLabel($payment, $locale),
                    'member' => $this->paymentMemberLabel($payment, $locale),
                    'amount' => (float) $payment->amount,
                    'method' => $this->normalizeLabel($payment->method, $locale),
                    'status' => $this->normalizeLabel($payment->status, $locale),
                    'created_by' => $payment->creator?->name ?? '',
                ];
            })->all(),
            'expenses' => $expenses->map(fn (Expense $expense): array => [
                'date' => $this->date($expense->date),
                'expense_id' => $expense->id,
                'category' => $expense->category,
                'amount' => (float) $expense->amount,
                'description' => $expense->description ?? '',
                'created_by' => $expense->creator?->name ?? '',
                'created_at' => $this->dateTime($expense->created_at),
            ])->all(),
            'expenses_by_category' => $expenses
                ->groupBy(fn (Expense $expense): string => $expense->category ?: 'Other')
                ->map(fn (Collection $items, string $category): array => [
                    'category' => $category ?: $this->t('other', $locale),
                    'entries' => $items->count(),
                    'amount' => $items->sum(fn (Expense $expense): float => (float) $expense->amount),
                ])
                ->sortByDesc('amount')
                ->values()
                ->all(),
            'shift_summary' => $shiftSummary,
            'shift_transactions' => $shiftTransactions,
            'payroll' => $payroll->map(fn (Payroll $row): array => [
                'month' => $row->month,
                'payroll_id' => $row->id,
                'employee' => $row->employee?->name ?? $this->t('unknown_employee', $locale),
                'role' => $this->normalizeLabel($row->employee?->role, $locale),
                'base_salary' => (float) $row->base_salary,
                'commissions_total' => (float) $row->commissions_total,
                'bonuses' => (float) $row->bonuses,
                'deductions' => (float) $row->deductions,
                'attendance_deductions' => (float) $row->attendance_deductions,
                'net_salary' => (float) $row->net_salary,
                'status' => $this->normalizeLabel($row->status, $locale),
                'paid_at' => $this->dateTime($row->paid_at),
            ])->all(),
            'salaries' => $employees->map(fn (Employee $employee): array => [
                'employee_id' => $employee->id,
                'employee' => $employee->name,
                'role' => $this->normalizeLabel($employee->role, $locale),
                'status' => $this->normalizeLabel($employee->status, $locale),
                'base_salary' => (float) $employee->base_salary,
                'pay_day' => $employee->pay_day ?? '',
                'shift' => $employee->shift?->name ?? '',
                'hire_date' => $this->date($employee->hire_date),
            ])->all(),
            'dues' => $dues,
        ];
    }

    /**
     * @param  Collection<int, Subscription|SubscriptionAddon>  $rows
     */
    private function sumPaymentsForModel(Collection $rows): float
    {
        return $rows->sum(fn ($row): float => $row->payments->sum(fn (Payment $payment): float => (float) $payment->amount));
    }

    /**
     * @param  Collection<int, Subscription>  $subscriptions
     * @param  Collection<int, SubscriptionAddon>  $addons
     * @param  Collection<int, Sale>  $sales
     * @param  Collection<int, Expense>  $expenses
     * @param  Collection<int, Payment>  $payments
     * @param  Collection<int, EmployeeShift>  $shifts
     * @return array<int, array<string, mixed>>
     */
    private function buildShiftTransactionRows(
        Collection $subscriptions,
        Collection $addons,
        Collection $sales,
        Collection $expenses,
        Collection $payments,
        Collection $shifts,
        Carbon $from,
        Carbon $to,
        string $locale,
    ): array {
        $rows = collect();

        $shiftMeta = $shifts
            ->map(fn (EmployeeShift $shift): array => [
                'shift' => $shift,
                'start' => $this->timeToMinutes($shift->starts_at),
                'end' => $this->timeToMinutes($shift->ends_at),
                'time_label' => $this->shiftTimeLabel($shift),
                'staff' => $shift->employees?->pluck('name')->join(', ') ?? '',
            ])
            ->values();

        foreach ($subscriptions as $subscription) {
            $actor = $subscription->soldBy ?? $subscription->creator;
            $collected = $subscription->payments->sum(fn (Payment $payment): float => (float) $payment->amount);
            $rows->push($this->shiftTransactionRow(
                occurredAt: Carbon::parse($subscription->created_at),
                source: $this->t('subscription', $locale),
                recordId: '#'.$subscription->id,
                member: $subscription->member?->name ?? $this->t('unknown_member', $locale),
                item: $subscription->plan?->name ?? $this->t('unknown_plan', $locale),
                details: trim($this->normalizeLabel($subscription->status, $locale).' · '.$this->date($subscription->start_date).' - '.$this->date($subscription->end_date), ' ·-'),
                bookedAmount: (float) $subscription->price_paid,
                collectedAmount: $collected,
                expenseAmount: 0.0,
                paymentMethod: $this->paymentMethodsLabel($subscription->payments, $locale),
                status: $this->normalizeLabel($subscription->status, $locale),
                actor: $actor,
                shiftMeta: $shiftMeta,
                locale: $locale,
            ));
        }

        foreach ($addons as $addon) {
            $actor = $addon->soldBy ?? $addon->creator;
            $collected = $addon->payments->sum(fn (Payment $payment): float => (float) $payment->amount);
            $rows->push($this->shiftTransactionRow(
                occurredAt: Carbon::parse($addon->created_at),
                source: $this->t('addon', $locale),
                recordId: '#'.$addon->id,
                member: $addon->member?->name ?? $this->t('unknown_member', $locale),
                item: $addon->plan?->name ?? $this->t('unknown_addon', $locale),
                details: trim(($addon->coach?->name ? $this->t('coach', $locale).': '.$addon->coach->name.' · ' : '').$this->normalizeLabel($addon->status, $locale), ' ·'),
                bookedAmount: (float) $addon->price_paid,
                collectedAmount: $collected,
                expenseAmount: 0.0,
                paymentMethod: $this->paymentMethodsLabel($addon->payments, $locale),
                status: $this->normalizeLabel($addon->status, $locale),
                actor: $actor,
                shiftMeta: $shiftMeta,
                locale: $locale,
            ));
        }

        foreach ($sales as $sale) {
            $saleCollected = $sale->status === 'completed' ? (float) ($sale->payment?->amount ?? $sale->total) : 0.0;

            $rows->push($this->shiftTransactionRow(
                occurredAt: Carbon::parse($sale->created_at),
                source: $this->t('pos_sale', $locale),
                recordId: '#'.$sale->id,
                member: $sale->member?->name ?? $this->t('walk_in', $locale),
                item: $sale->items->map(fn ($item): string => ($item->product?->name ?? $this->t('product', $locale)).' x'.$item->quantity)->join(', '),
                details: trim($this->t('discount', $locale).': '.number_format((float) $sale->discount, 2, '.', '').($sale->notes ? ' · '.$sale->notes : ''), ' ·'),
                bookedAmount: (float) $sale->total,
                collectedAmount: $saleCollected,
                expenseAmount: 0.0,
                paymentMethod: $this->normalizeLabel($sale->payment_method, $locale),
                status: $this->normalizeLabel($sale->status, $locale),
                actor: $sale->soldBy,
                shiftMeta: $shiftMeta,
                locale: $locale,
            ));
        }

        foreach ($expenses as $expense) {
            $rows->push($this->shiftTransactionRow(
                occurredAt: Carbon::parse($expense->created_at ?? $expense->date),
                source: $this->t('expense', $locale),
                recordId: '#'.$expense->id,
                member: '',
                item: $expense->category ?: $this->t('other', $locale),
                details: $expense->description ?? '',
                bookedAmount: 0.0,
                collectedAmount: 0.0,
                expenseAmount: (float) $expense->amount,
                paymentMethod: '',
                status: '',
                actor: $expense->creator,
                shiftMeta: $shiftMeta,
                locale: $locale,
            ));
        }

        foreach ($payments as $payment) {
            $payable = $payment->payable;

            if ($payable instanceof Subscription || $payable instanceof SubscriptionAddon || $payable instanceof Sale) {
                $payableCreatedAt = $payable->created_at ? Carbon::parse($payable->created_at) : null;

                if ($payableCreatedAt && $payableCreatedAt->betweenIncluded($from, $to)) {
                    continue;
                }
            }

            $rows->push($this->shiftTransactionRow(
                occurredAt: Carbon::parse($payment->paid_at ?? $payment->created_at),
                source: $this->paymentSourceLabel($payment, $locale),
                recordId: '#'.$payment->id,
                member: $this->paymentMemberLabel($payment, $locale),
                item: $this->paymentItemLabel($payment, $locale),
                details: $this->t('payment_collection', $locale),
                bookedAmount: 0.0,
                collectedAmount: (float) $payment->amount,
                expenseAmount: 0.0,
                paymentMethod: $this->normalizeLabel($payment->method, $locale),
                status: $this->normalizeLabel($payment->status, $locale),
                actor: $payment->creator,
                shiftMeta: $shiftMeta,
                locale: $locale,
            ));
        }

        return $rows
            ->sortBy(['transaction_at', 'source', 'record_id'])
            ->values()
            ->all();
    }

    /**
     * @param  array<int, array<string, mixed>>  $transactions
     * @return array<int, array<string, mixed>>
     */
    private function buildShiftSummaryRows(array $transactions, string $locale): array
    {
        return collect($transactions)
            ->groupBy(fn (array $row): string => (string) $row['date'].'|'.(string) $row['shift'])
            ->map(function (Collection $rows) use ($locale): array {
                $first = $rows->first();
                $booked = $rows->sum(fn (array $row): float => (float) $row['booked_amount']);
                $collected = $rows->sum(fn (array $row): float => (float) $row['collected_amount']);
                $expenses = $rows->sum(fn (array $row): float => (float) $row['expense_amount']);

                return [
                    'date' => (string) ($first['date'] ?? ''),
                    'shift' => (string) ($first['shift'] ?? ''),
                    'shift_time' => (string) ($first['shift_time'] ?? ''),
                    'staff_on_shift' => (string) ($first['staff_on_shift'] ?? ''),
                    'transactions' => $rows->count(),
                    'booked_amount' => $booked,
                    'collected_amount' => $collected,
                    'expense_amount' => $expenses,
                    'net_cash' => $collected - $expenses,
                    'handled_by' => $rows->pluck('handled_by')->filter()->unique()->implode(', ') ?: $this->t('unknown_employee', $locale),
                ];
            })
            ->sortBy(['date', 'shift'])
            ->values()
            ->all();
    }

    /**
     * @param  Collection<int, array<string, mixed>>  $shiftMeta
     * @return array<string, mixed>
     */
    private function shiftTransactionRow(
        Carbon $occurredAt,
        string $source,
        string $recordId,
        string $member,
        string $item,
        string $details,
        float $bookedAmount,
        float $collectedAmount,
        float $expenseAmount,
        string $paymentMethod,
        string $status,
        ?User $actor,
        Collection $shiftMeta,
        string $locale,
    ): array {
        $matched = $this->shiftForTime($occurredAt, $shiftMeta);
        $shift = $matched['shift'] ?? null;

        return [
            'date' => $occurredAt->toDateString(),
            'transaction_at' => $this->dateTime($occurredAt),
            'shift' => $shift?->name ?? $this->t('outside_shift', $locale),
            'shift_time' => $matched ? $matched['time_label'] : '',
            'staff_on_shift' => $matched ? $matched['staff'] : '',
            'source' => $source,
            'record_id' => $recordId,
            'member' => $member,
            'item' => $item,
            'details' => $details,
            'booked_amount' => $bookedAmount,
            'collected_amount' => $collectedAmount,
            'expense_amount' => $expenseAmount,
            'net_cash' => $collectedAmount - $expenseAmount,
            'payment_method' => $paymentMethod,
            'status' => $status,
            'handled_by' => $actor?->employee?->name ?? $actor?->name ?? $this->t('unknown_employee', $locale),
            'handled_by_role' => $this->normalizeLabel($actor?->employee?->role, $locale),
            'handled_by_shift' => $actor?->employee?->shift?->name ?? '',
        ];
    }

    /**
     * @param  Collection<int, array<string, mixed>>  $shiftMeta
     * @return array<string, mixed>|null
     */
    private function shiftForTime(Carbon $time, Collection $shiftMeta): ?array
    {
        $timeMinutes = ((int) $time->format('H')) * 60 + (int) $time->format('i');

        return $shiftMeta->first(function (array $meta) use ($timeMinutes): bool {
            $start = $meta['start'];
            $end = $meta['end'];

            if ($start === $end) {
                return true;
            }

            if ($start < $end) {
                return $timeMinutes >= $start && $timeMinutes < $end;
            }

            return $timeMinutes >= $start || $timeMinutes < $end;
        });
    }

    private function shiftTimeLabel(EmployeeShift $shift): string
    {
        return Carbon::parse($shift->starts_at)->format('g:i A').' - '.Carbon::parse($shift->ends_at)->format('g:i A');
    }

    private function timeToMinutes(mixed $value): int
    {
        $time = Carbon::parse($value);

        return ((int) $time->format('H')) * 60 + (int) $time->format('i');
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function buildDuesRows(string $locale): array
    {
        $subscriptionPaidTotals = Payment::query()
            ->selectRaw('payable_id, SUM(amount) as paid_total')
            ->where('payable_type', Subscription::class)
            ->groupBy('payable_id');

        $addonPaidTotals = Payment::query()
            ->join('subscription_addons', 'subscription_addons.id', '=', 'payments.payable_id')
            ->selectRaw('subscription_addons.subscription_id, SUM(payments.amount) as paid_total')
            ->where('payments.payable_type', SubscriptionAddon::class)
            ->groupBy('subscription_addons.subscription_id');

        $addonPriceTotals = SubscriptionAddon::query()
            ->selectRaw('subscription_id, SUM(price_paid) as price_total')
            ->groupBy('subscription_id');

        $subscriptions = Subscription::query()
            ->with(['member:id,name', 'plan:id,name'])
            ->leftJoinSub($subscriptionPaidTotals, 'subscription_paid_totals', 'subscription_paid_totals.payable_id', '=', 'subscriptions.id')
            ->leftJoinSub($addonPaidTotals, 'addon_paid_totals', 'addon_paid_totals.subscription_id', '=', 'subscriptions.id')
            ->leftJoinSub($addonPriceTotals, 'addon_price_totals', 'addon_price_totals.subscription_id', '=', 'subscriptions.id')
            ->select('subscriptions.*')
            ->selectRaw('COALESCE(subscription_paid_totals.paid_total, 0) as base_paid_total')
            ->selectRaw('COALESCE(addon_paid_totals.paid_total, 0) as addon_paid_total')
            ->selectRaw('COALESCE(addon_price_totals.price_total, 0) as addon_price_total')
            ->whereRaw('(subscriptions.price_paid + COALESCE(addon_price_totals.price_total, 0)) > (COALESCE(subscription_paid_totals.paid_total, 0) + COALESCE(addon_paid_totals.paid_total, 0))')
            ->orderBy('end_date')
            ->get();

        return $subscriptions
            ->map(function (Subscription $subscription) use ($locale): ?array {
                $basePaid = (float) ($subscription->base_paid_total ?? 0);
                $addonPrice = (float) ($subscription->addon_price_total ?? 0);
                $addonPaid = (float) ($subscription->addon_paid_total ?? 0);
                $booked = (float) $subscription->price_paid + $addonPrice;
                $collected = $basePaid + $addonPaid;
                $balance = max($booked - $collected, 0);

                if ($balance <= 0) {
                    return null;
                }

                return [
                    'subscription_id' => $subscription->id,
                    'member' => $subscription->member?->name ?? $this->t('unknown_member', $locale),
                    'plan' => $subscription->plan?->name ?? $this->t('unknown_plan', $locale),
                    'end_date' => $this->date($subscription->end_date),
                    'status' => $this->normalizeLabel($subscription->status, $locale),
                    'booked_total' => $booked,
                    'collected' => $collected,
                    'balance' => $balance,
                ];
            })
            ->filter()
            ->values()
            ->all();
    }

    private function paymentSourceLabel(Payment $payment, string $locale): string
    {
        return match ($payment->payable_type) {
            Subscription::class => $this->t('subscription', $locale),
            SubscriptionAddon::class => $this->t('addon', $locale),
            Sale::class => $this->t('pos_sale', $locale),
            default => $this->normalizeLabel(class_basename((string) $payment->payable_type), $locale),
        };
    }

    private function paymentItemLabel(Payment $payment, string $locale): string
    {
        $payable = $payment->payable;

        return match (true) {
            $payable instanceof Subscription => $payable->plan?->name ?? $this->t('subscription', $locale).' #'.$payable->id,
            $payable instanceof SubscriptionAddon => $payable->plan?->name ?? $this->t('addon', $locale).' #'.$payable->id,
            $payable instanceof Sale => $payable->items->map(fn ($item): string => ($item->product?->name ?? $this->t('product', $locale)).' x'.$item->quantity)->join(', '),
            default => $this->t('payment', $locale).' #'.$payment->id,
        };
    }

    private function paymentMemberLabel(Payment $payment, string $locale): string
    {
        $payable = $payment->payable;

        return match (true) {
            $payable instanceof Subscription => $payable->member?->name ?? $this->t('unknown_member', $locale),
            $payable instanceof SubscriptionAddon => $payable->member?->name ?? $this->t('unknown_member', $locale),
            $payable instanceof Sale => $payable->member?->name ?? $this->t('walk_in', $locale),
            default => '',
        };
    }

    private function paymentMethodsLabel(Collection $payments, string $locale): string
    {
        return $payments
            ->pluck('method')
            ->filter()
            ->unique()
            ->map(fn (string $method): string => $this->normalizeLabel($method, $locale))
            ->implode(', ');
    }

    private function normalizeLabel(?string $value, string $locale): string
    {
        if ($value === null || $value === '') {
            return '';
        }

        $normalized = str_replace('_', ' ', Str::snake($value));
        $translated = $this->translations($locale)[$normalized] ?? null;

        if ($translated) {
            return $translated;
        }

        return Str::headline(str_replace('_', ' ', $value));
    }

    private function t(string $key, string $locale): string
    {
        return $this->translations($locale)[$key] ?? Str::headline(str_replace('_', ' ', $key));
    }

    /**
     * @return array<string, string>
     */
    private function translations(string $locale): array
    {
        if (isset($this->translationCache[$locale])) {
            return $this->translationCache[$locale];
        }

        if ($locale === 'ar') {
            return $this->translationCache[$locale] = [
                'active' => 'نشط',
                'add on' => 'إضافة',
                'addon' => 'إضافة',
                'bank transfer' => 'تحويل بنكي',
                'captain' => 'كابتن',
                'card' => 'بطاقة',
                'cash' => 'نقدي',
                'coach' => 'مدرب',
                'completed' => 'مكتمل',
                'discount' => 'خصم',
                'employee' => 'موظف',
                'expense' => 'مصروف',
                'manager' => 'مدير',
                'other' => 'أخرى',
                'outside_shift' => 'خارج الشيفت',
                'partial' => 'جزئي',
                'paid' => 'مدفوع',
                'payment' => 'دفعة',
                'payment_collection' => 'تحصيل دفعة',
                'pending' => 'معلق',
                'pos sale' => 'بيع نقطة البيع',
                'pos_sale' => 'بيع نقطة البيع',
                'product' => 'منتج',
                'stopped' => 'متوقف',
                'subscription' => 'اشتراك',
                'unknown_addon' => 'إضافة غير معروفة',
                'unknown_employee' => 'موظف غير معروف',
                'unknown_member' => 'عضو غير معروف',
                'unknown_plan' => 'خطة غير معروفة',
                'voided' => 'ملغي',
                'walk_in' => 'عميل عابر',
            ];
        }

        return $this->translationCache[$locale] = [
            'addon' => 'Add-on',
            'discount' => 'Discount',
            'expense' => 'Expense',
            'other' => 'Other',
            'outside_shift' => 'Outside shift',
            'payment' => 'Payment',
            'payment_collection' => 'Payment collection',
            'pos_sale' => 'POS sale',
            'product' => 'Product',
            'subscription' => 'Subscription',
            'unknown_addon' => 'Unknown add-on',
            'unknown_employee' => 'Unknown employee',
            'unknown_member' => 'Unknown member',
            'unknown_plan' => 'Unknown plan',
            'walk_in' => 'Walk-in',
        ];
    }

    private function date(mixed $value): string
    {
        if (! $value) {
            return '';
        }

        return Carbon::parse($value)->toDateString();
    }

    private function dateTime(mixed $value): string
    {
        if (! $value) {
            return '';
        }

        return Carbon::parse($value)->toDateTimeString();
    }
}
