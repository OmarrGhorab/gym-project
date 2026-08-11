<?php

namespace App\Actions\Reports;

use App\Models\Expense;
use App\Models\MemberBooking;
use App\Models\MemberVisit;
use App\Models\Payment;
use App\Models\Sale;
use App\Models\Subscription;
use App\Models\SubscriptionAddon;
use App\Models\SubscriptionRefund;
use Carbon\CarbonImmutable;
use Carbon\CarbonPeriod;

final class ReportsOverview
{
    /**
     * @param  array{from?: string|null, to?: string|null}  $params
     * @return array<string, mixed>
     */
    public function execute(array $params = []): array
    {
        $from = CarbonImmutable::parse($params['from'] ?? now()->toDateString())->startOfDay();
        $to = CarbonImmutable::parse($params['to'] ?? $from->toDateString())->endOfDay();

        $expenses = $this->amountsByDate(Expense::query()->whereBetween('date', [$from, $to]), 'date');
        $posPayments = $this->paymentsByDate(Sale::class, $from, $to);
        // Membership revenue includes both the main subscription and any paid
        // add-ons sold with it. This keeps the overview aligned with shift and
        // income/cashflow reports.
        //
        // These are GROSS collections. Netting refunds in here made "Membership
        // revenue" go negative on a heavy refund day with nothing on screen to
        // explain it, so refunds get their own column instead.
        $membershipPayments = $this->paymentsByDate([Subscription::class, SubscriptionAddon::class], $from, $to);
        $refunds = $this->amountsByDate(
            SubscriptionRefund::query()->whereBetween('refunded_at', [$from, $to]),
            'refunded_at',
        );
        $bookings = $this->countsByDate(MemberBooking::query()->whereBetween('starts_at', [$from, $to]), 'starts_at');
        $memberships = $this->countsByDate(Subscription::query()->whereBetween('created_at', [$from, $to]), 'created_at');
        $sessions = $this->countsByDate(MemberVisit::query()->whereBetween('check_in_at', [$from, $to]), 'check_in_at');

        $rows = collect(CarbonPeriod::create($from, '1 day', $to))->map(function ($day) use ($expenses, $refunds, $posPayments, $membershipPayments, $bookings, $memberships, $sessions): array {
            $date = $day->toDateString();
            $pos = $posPayments[$date] ?? ['amount' => 0.0, 'count' => 0];
            $membership = $membershipPayments[$date] ?? ['amount' => 0.0, 'count' => 0];

            return [
                'date' => $date,
                'expenses' => $this->money($expenses[$date] ?? 0),
                'pos_sales' => $this->money($pos['amount']),
                'pos_orders' => $pos['count'],
                'bookings' => $bookings[$date] ?? 0,
                'memberships' => $memberships[$date] ?? 0,
                'membership_revenue' => $this->money($membership['amount']),
                'refunds' => $this->money($refunds[$date] ?? 0),
                'session_visits' => $sessions[$date] ?? 0,
            ];
        })->values();

        return [
            'period' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
            'totals' => [
                'expenses' => $this->money($rows->sum(fn (array $row) => (float) $row['expenses'])),
                'pos_sales' => $this->money($rows->sum(fn (array $row) => (float) $row['pos_sales'])),
                'pos_orders' => $rows->sum('pos_orders'),
                'bookings' => $rows->sum('bookings'),
                'memberships' => $rows->sum('memberships'),
                'membership_revenue' => $this->money($rows->sum(fn (array $row) => (float) $row['membership_revenue'])),
                'refunds' => $this->money($rows->sum(fn (array $row) => (float) $row['refunds'])),
                'session_visits' => $rows->sum('session_visits'),
            ],
            'daily' => $rows->reverse()->values()->all(),
        ];
    }

    /** @return array<string, float> */
    private function amountsByDate($query, string $dateColumn): array
    {
        return $query->selectRaw("DATE({$dateColumn}) as report_date, SUM(amount) as total")
            ->groupBy('report_date')
            ->pluck('total', 'report_date')
            ->map(fn ($amount) => (float) $amount)
            ->all();
    }

    /** @return array<string, int> */
    private function countsByDate($query, string $dateColumn): array
    {
        return $query->selectRaw("DATE({$dateColumn}) as report_date, COUNT(*) as total")
            ->groupBy('report_date')
            ->pluck('total', 'report_date')
            ->map(fn ($count) => (int) $count)
            ->all();
    }

    /** @return array<string, array{amount: float, count: int}> */
    /** @param class-string|list<class-string> $payableTypes */
    private function paymentsByDate(string|array $payableTypes, CarbonImmutable $from, CarbonImmutable $to): array
    {
        return Payment::query()
            ->collected()
            ->whereIn('payable_type', (array) $payableTypes)
            ->whereBetween('paid_at', [$from, $to])
            ->selectRaw('DATE(paid_at) as report_date, SUM(amount) as total, COUNT(DISTINCT payable_id) as payment_count')
            ->groupBy('report_date')
            ->get()
            ->mapWithKeys(fn ($row): array => [
                $row->report_date => ['amount' => (float) $row->total, 'count' => (int) $row->payment_count],
            ])
            ->all();
    }

    private function money(float $amount): string
    {
        return number_format($amount, 2, '.', '');
    }
}
