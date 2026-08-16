<?php

namespace App\Actions\Reports;

use App\Models\Attendance;
use App\Models\Employee;
use App\Models\Expense;
use App\Models\Payment;
use App\Models\Sale;
use App\Models\ShiftSession;
use App\Models\Subscription;
use App\Models\SubscriptionAddon;
use App\Support\BusinessDay;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * Everything that happened on one working day, and who did it.
 *
 * Built from the source records every time rather than from a stored snapshot,
 * so a report opened a week later still agrees with the ledger it came from. The
 * only thing kept on disk is the PDF the 05:15 job renders, which is a document
 * rather than a source of truth.
 *
 * The day is the gym's, not the calendar's: takings are read from the business
 * day's window (05:00 to 05:00 by default), because the desk trades past
 * midnight and splitting a night shift in two would file half its money under
 * the wrong date.
 */
class BuildDailyReport
{
    /**
     * @return array<string, mixed>
     */
    public function handle(Carbon|string $businessDate): array
    {
        $date = $businessDate instanceof Carbon ? $businessDate->toDateString() : $businessDate;
        [$from, $to] = BusinessDay::windowFor($date);

        $payments = $this->payments($from, $to);
        $expenses = $this->expenses($date);

        return [
            'business_date' => $date,
            'window' => [
                'from' => $from->toIso8601String(),
                'to' => $to->toIso8601String(),
            ],
            'money' => $this->money($payments, $expenses),
            'by_staff' => $this->byStaff($payments, $expenses),
            'payments' => $payments->map(fn (Payment $payment): array => $this->paymentRow($payment))->all(),
            'expenses' => $expenses->map(fn (Expense $expense): array => $this->expenseRow($expense))->all(),
            'shifts' => $this->shifts($date),
            'attendance' => $this->attendance($date),
            'memberships' => $this->memberships($from, $to),
        ];
    }

    /**
     * @return Collection<int, Payment>
     */
    private function payments(Carbon $from, Carbon $to): Collection
    {
        return Payment::query()
            ->revenue()
            ->with(['creator:id,name', 'shiftSession.shift:id,name'])
            ->whereBetween('paid_at', [$from, $to])
            ->orderBy('paid_at')
            ->get();
    }

    /**
     * Read on the expense's own date rather than when it was typed in.
     *
     * An expense carries the day it belongs to, set by whoever recorded it, and
     * that is the day it is answerable on — a receipt entered at 01:00 for the
     * evening before belongs in the evening's report, not the night's.
     *
     * @return Collection<int, Expense>
     */
    private function expenses(string $date): Collection
    {
        return Expense::query()
            ->with('creator:id,name')
            ->whereDate('date', $date)
            ->orderBy('created_at')
            ->get();
    }

    /**
     * @param  Collection<int, Payment>  $payments
     * @param  Collection<int, Expense>  $expenses
     * @return array<string, mixed>
     */
    private function money(Collection $payments, Collection $expenses): array
    {
        $byMethod = ['cash' => '0.00', 'card' => '0.00', 'bank' => '0.00'];
        $bySource = ['subscriptions' => '0.00', 'addons' => '0.00', 'pos' => '0.00', 'other' => '0.00'];
        $collections = '0.00';
        $refunds = '0.00';

        foreach ($payments as $payment) {
            $amount = bcadd((string) $payment->amount, '0.00', 2);
            $collections = bcadd($collections, $amount, 2);

            // A refund is a negative payment. It already nets out of the totals
            // above; this only surfaces the magnitude so the day can be read.
            if (bccomp($amount, '0.00', 2) === -1) {
                $refunds = bcadd($refunds, bcmul($amount, '-1', 2), 2);
            }

            $method = (string) $payment->method;
            if (array_key_exists($method, $byMethod)) {
                $byMethod[$method] = bcadd($byMethod[$method], $amount, 2);
            }

            $source = $this->sourceOf($payment);
            $bySource[$source] = bcadd($bySource[$source], $amount, 2);
        }

        $expensesTotal = '0.00';
        $expensesByCategory = [];
        foreach ($expenses as $expense) {
            $amount = bcadd((string) $expense->amount, '0.00', 2);
            $expensesTotal = bcadd($expensesTotal, $amount, 2);
            $category = (string) ($expense->category ?: 'other');
            $expensesByCategory[$category] = bcadd($expensesByCategory[$category] ?? '0.00', $amount, 2);
        }

        arsort($expensesByCategory);

        return [
            'collections' => $collections,
            'refunds' => $refunds,
            'expenses' => $expensesTotal,
            'net' => bcsub($collections, $expensesTotal, 2),
            'by_method' => $byMethod,
            'by_source' => $bySource,
            'expenses_by_category' => $expensesByCategory,
            'payment_count' => $payments->count(),
            'expense_count' => $expenses->count(),
        ];
    }

    /**
     * Who took the money in and who spent it.
     *
     * The point of the daily report: an amount with nobody's name against it
     * cannot be asked about the next morning.
     *
     * @param  Collection<int, Payment>  $payments
     * @param  Collection<int, Expense>  $expenses
     * @return array<int, array<string, mixed>>
     */
    private function byStaff(Collection $payments, Collection $expenses): array
    {
        $staff = [];

        $bucket = function (?int $id, ?string $name) use (&$staff): string {
            $key = (string) ($id ?? 'system');
            $staff[$key] ??= [
                'user_id' => $id,
                'name' => $name ?? 'System (automatic)',
                'collected' => '0.00',
                'spent' => '0.00',
                'payment_count' => 0,
                'expense_count' => 0,
            ];

            return $key;
        };

        foreach ($payments as $payment) {
            $key = $bucket($payment->created_by, $payment->creator?->name);
            $staff[$key]['collected'] = bcadd($staff[$key]['collected'], (string) $payment->amount, 2);
            $staff[$key]['payment_count']++;
        }

        foreach ($expenses as $expense) {
            $key = $bucket($expense->created_by, $expense->creator?->name);
            $staff[$key]['spent'] = bcadd($staff[$key]['spent'], (string) $expense->amount, 2);
            $staff[$key]['expense_count']++;
        }

        $rows = array_values($staff);
        usort($rows, static fn (array $a, array $b): int => bccomp($b['collected'], $a['collected'], 2));

        return $rows;
    }

    /**
     * @return array<string, mixed>
     */
    private function paymentRow(Payment $payment): array
    {
        return [
            'id' => $payment->id,
            'at' => $payment->paid_at?->toIso8601String(),
            'time' => $payment->paid_at?->format('H:i'),
            'amount' => bcadd((string) $payment->amount, '0.00', 2),
            'method' => $payment->method,
            'source' => $this->sourceOf($payment),
            'status' => $payment->status,
            'recorded_by' => $payment->creator?->name ?? 'System (automatic)',
            'shift' => $payment->shiftSession?->shift?->name,
            'shift_session_id' => $payment->shift_session_id,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function expenseRow(Expense $expense): array
    {
        return [
            'id' => $expense->id,
            'at' => $expense->created_at?->toIso8601String(),
            'time' => $expense->created_at?->format('H:i'),
            'amount' => bcadd((string) $expense->amount, '0.00', 2),
            'category' => $expense->category,
            'description' => $expense->description,
            'recorded_by' => $expense->creator?->name ?? 'System (automatic)',
        ];
    }

    private function sourceOf(Payment $payment): string
    {
        $type = (string) $payment->payable_type;

        return match (true) {
            $type === Subscription::class || str_ends_with($type, '\\Subscription') => 'subscriptions',
            $type === SubscriptionAddon::class || str_ends_with($type, '\\SubscriptionAddon') => 'addons',
            $type === Sale::class || str_ends_with($type, '\\Sale') => 'pos',
            default => 'other',
        };
    }

    /**
     * Who held the desk, and how their drawer came out.
     *
     * @return array<int, array<string, mixed>>
     */
    private function shifts(string $date): array
    {
        return ShiftSession::query()
            ->with(['shift:id,name', 'openedByEmployee:id,name', 'closedByEmployee:id,name'])
            ->whereDate('business_date', $date)
            ->orderBy('opened_at')
            ->get()
            ->map(function (ShiftSession $session): array {
                $expected = $session->expected_cash;
                $counted = $session->counted_cash;

                return [
                    'id' => $session->id,
                    'shift' => $session->shift?->name,
                    'staff' => $session->openedByEmployee?->name ?? 'System (automatic)',
                    'closed_by' => $session->closedByEmployee?->name,
                    'opened_at' => $session->opened_at?->format('H:i'),
                    'closed_at' => $session->closed_at?->format('H:i'),
                    'status' => $session->status,
                    'opening_float' => $this->money2($session->opening_float),
                    'expected_cash' => $expected !== null ? $this->money2($expected) : null,
                    'counted_cash' => $counted !== null ? $this->money2($counted) : null,
                    'variance' => $expected !== null && $counted !== null
                        ? bcsub($this->money2($counted), $this->money2($expected), 2)
                        : null,
                ];
            })
            ->all();
    }

    /**
     * Who was in, who was not, and who never scanned.
     *
     * @return array<string, mixed>
     */
    private function attendance(string $date): array
    {
        $employees = Employee::query()
            ->active()
            ->with('shift:id,name')
            ->orderBy('name')
            ->get();

        $records = Attendance::query()
            ->whereDate('date', $date)
            ->get()
            ->keyBy('employee_id');

        $rows = $employees->map(function (Employee $employee) use ($records): array {
            $record = $records->get($employee->id);

            return [
                'employee_id' => $employee->id,
                'name' => $employee->name,
                'role' => $employee->role,
                'shift' => $employee->shift?->name,
                'check_in' => $record?->check_in?->format('H:i'),
                'check_out' => $record?->check_out?->format('H:i'),
                // No row at all is its own answer: nobody scanned them either way.
                'status' => $record?->status ?? 'no_scan',
                'notes' => $record?->notes,
            ];
        });

        $countOf = static fn (string $status): int => $rows->where('status', $status)->count();

        return [
            'rows' => $rows->values()->all(),
            'totals' => [
                'employees' => $rows->count(),
                'present' => $countOf('present'),
                'absent' => $countOf('absent'),
                'late' => $countOf('late'),
                'no_scan' => $countOf('no_scan'),
                // Scanned in and never out — the desk was left without a sign-off.
                'still_in' => $rows->filter(
                    static fn (array $row): bool => $row['check_in'] !== null && $row['check_out'] === null,
                )->count(),
            ],
        ];
    }

    /**
     * Memberships sold on the day, and who sold them.
     *
     * @return array<string, mixed>
     */
    private function memberships(Carbon $from, Carbon $to): array
    {
        $subscriptions = Subscription::query()
            ->with(['member:id,name', 'plan:id,name', 'soldBy:id,name'])
            ->whereBetween('created_at', [$from, $to])
            ->orderBy('created_at')
            ->get();

        return [
            'count' => $subscriptions->count(),
            'rows' => $subscriptions->map(static fn (Subscription $subscription): array => [
                'id' => $subscription->id,
                'time' => $subscription->created_at?->format('H:i'),
                'member' => $subscription->member?->name,
                'plan' => $subscription->plan?->name,
                'price' => number_format((float) $subscription->price_paid, 2, '.', ''),
                'sold_by' => $subscription->soldBy?->name ?? 'System (automatic)',
            ])->all(),
        ];
    }

    private function money2(mixed $value): string
    {
        return bcadd((string) ($value ?? '0'), '0.00', 2);
    }
}
