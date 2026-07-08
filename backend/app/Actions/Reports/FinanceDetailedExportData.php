<?php

namespace App\Actions\Reports;

use App\Models\Employee;
use App\Models\Expense;
use App\Models\Payment;
use App\Models\Payroll;
use App\Models\Sale;
use App\Models\Subscription;
use App\Models\SubscriptionAddon;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class FinanceDetailedExportData
{
    /**
     * @param  array{from?: string, to?: string, group_by?: string|null}  $filters
     * @return array<string, mixed>
     */
    public function build(array $filters, string $locale = 'en'): array
    {
        $from = Carbon::parse($filters['from'] ?? now()->startOfYear()->toDateString())->startOfDay();
        $to = Carbon::parse($filters['to'] ?? now()->toDateString())->endOfDay();

        $subscriptions = Subscription::query()
            ->with(['member:id,name', 'plan:id,name,category,type', 'soldBy:id,name', 'payments'])
            ->whereBetween('created_at', [$from->toDateTimeString(), $to->toDateTimeString()])
            ->orderBy('created_at')
            ->get();

        $addons = SubscriptionAddon::query()
            ->with(['member:id,name', 'plan:id,name,category,type', 'coach:id,name', 'payments'])
            ->whereBetween('created_at', [$from->toDateTimeString(), $to->toDateTimeString()])
            ->orderBy('created_at')
            ->get();

        $sales = Sale::query()
            ->with(['member:id,name', 'soldBy:id,name', 'items.product:id,name', 'payment'])
            ->whereBetween('created_at', [$from->toDateTimeString(), $to->toDateTimeString()])
            ->orderBy('created_at')
            ->get();

        $payments = Payment::query()
            ->with(['creator:id,name', 'payable'])
            ->whereBetween('paid_at', [$from->toDateTimeString(), $to->toDateTimeString()])
            ->orderBy('paid_at')
            ->get();

        $expenses = Expense::query()
            ->with('creator:id,name')
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

        $dues = $this->buildDuesRows($locale);

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
                'commission_rate' => (float) $employee->commission_rate,
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
     * @return array<int, array<string, mixed>>
     */
    private function buildDuesRows(string $locale): array
    {
        $subscriptions = Subscription::query()
            ->with(['member:id,name', 'plan:id,name', 'payments', 'addons.payments'])
            ->orderBy('end_date')
            ->get();

        return $subscriptions
            ->map(function (Subscription $subscription) use ($locale): ?array {
                $basePaid = $subscription->payments->sum(fn (Payment $payment): float => (float) $payment->amount);
                $addonPrice = $subscription->addons->sum(fn (SubscriptionAddon $addon): float => (float) $addon->price_paid);
                $addonPaid = $subscription->addons->sum(fn (SubscriptionAddon $addon): float => $addon->payments->sum(fn (Payment $payment): float => (float) $payment->amount));
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
            $payable instanceof Sale => $payable->items()->with('product:id,name')->get()->map(fn ($item): string => ($item->product?->name ?? $this->t('product', $locale)).' x'.$item->quantity)->join(', '),
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
        if ($locale === 'ar') {
            return [
                'active' => 'نشط',
                'add on' => 'إضافة',
                'addon' => 'إضافة',
                'bank transfer' => 'تحويل بنكي',
                'captain' => 'كابتن',
                'card' => 'بطاقة',
                'cash' => 'نقدي',
                'coach' => 'مدرب',
                'completed' => 'مكتمل',
                'employee' => 'موظف',
                'manager' => 'مدير',
                'other' => 'أخرى',
                'partial' => 'جزئي',
                'paid' => 'مدفوع',
                'payment' => 'دفعة',
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

        return [
            'addon' => 'Add-on',
            'other' => 'Other',
            'payment' => 'Payment',
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
