<?php

namespace App\Actions\ShiftSessions;

use App\Models\Expense;
use App\Models\Payment;
use App\Models\Sale;
use App\Models\ShiftSession;
use App\Models\Subscription;
use App\Models\SubscriptionAddon;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

class ComputeShiftSessionTotals
{
    /**
     * @return array{
     *     cash: string,
     *     card: string,
     *     bank: string,
     *     expenses: string,
     *     net: string,
     *     opening_float: string,
     *     collections: string,
     *     refunds: string,
     *     payment_count: int,
     *     expense_count: int,
     *     by_method: array{cash: string, card: string, bank: string},
     *     by_source: array{
     *         subscriptions: string,
     *         addons: string,
     *         pos: string,
     *         other: string,
     *         refunds: string,
     *         expenses: string
     *     }
     * }
     */
    public function handle(ShiftSession $session): array
    {
        // Pull untagged money into this session before summing.
        $this->claimOrphanMoney($session);

        $payments = Payment::query()
            ->revenue()
            ->where('shift_session_id', $session->id)
            ->get(['id', 'amount', 'method', 'status', 'payable_type', 'payable_id', 'paid_at', 'shift_session_id']);

        $expenseAgg = Expense::query()
            ->where('shift_session_id', $session->id)
            ->selectRaw('COUNT(*) as rows_count, COALESCE(SUM(amount), 0) as amount_sum')
            ->first();

        return $this->computeFrom(
            $session,
            $payments,
            (int) ($expenseAgg->rows_count ?? 0),
            bcadd((string) ($expenseAgg->amount_sum ?? 0), '0.00', 2),
        );
    }

    /**
     * Aggregate pre-fetched payments/expense totals for a session.
     *
     * @param  Collection<int, Payment>  $payments
     * @return array{
     *     cash: string,
     *     card: string,
     *     bank: string,
     *     expenses: string,
     *     net: string,
     *     opening_float: string,
     *     collections: string,
     *     refunds: string,
     *     payment_count: int,
     *     expense_count: int,
     *     by_method: array{cash: string, card: string, bank: string},
     *     by_source: array{
     *         subscriptions: string,
     *         addons: string,
     *         pos: string,
     *         other: string,
     *         refunds: string,
     *         expenses: string
     *     }
     * }
     */
    public function computeFrom(ShiftSession $session, Collection $payments, int $expenseCount, string $expenses): array
    {
        $methodCash = '0.00';
        $methodCard = '0.00';
        $methodBank = '0.00';
        $subscriptions = '0.00';
        $addons = '0.00';
        $pos = '0.00';
        $other = '0.00';
        $refundsMagnitude = '0.00';

        foreach ($payments as $payment) {
            $amount = bcadd((string) $payment->amount, '0.00', 2);
            $method = strtolower((string) $payment->method);

            if ($method === 'cash') {
                $methodCash = bcadd($methodCash, $amount, 2);
            } elseif ($method === 'card') {
                $methodCard = bcadd($methodCard, $amount, 2);
            } elseif (in_array($method, ['bank_transfer', 'bank'], true)) {
                $methodBank = bcadd($methodBank, $amount, 2);
            } else {
                $methodCash = bcadd($methodCash, $amount, 2);
            }

            if (bccomp($amount, '0.00', 2) === -1) {
                $refundsMagnitude = bcadd($refundsMagnitude, bcmul($amount, '-1', 2), 2);
            }

            $payableType = (string) $payment->payable_type;

            if ($payableType === Subscription::class || str_ends_with($payableType, '\\Subscription')) {
                $subscriptions = bcadd($subscriptions, $amount, 2);
            } elseif ($payableType === SubscriptionAddon::class || str_ends_with($payableType, '\\SubscriptionAddon')) {
                $addons = bcadd($addons, $amount, 2);
            } elseif ($payableType === Sale::class || str_ends_with($payableType, '\\Sale')) {
                $pos = bcadd($pos, $amount, 2);
            } else {
                $other = bcadd($other, $amount, 2);
            }
        }

        $openingFloat = bcadd((string) $session->opening_float, '0.00', 2);
        $collections = bcadd(bcadd($methodCash, $methodCard, 2), $methodBank, 2);
        $cashWithFloat = bcadd($methodCash, $openingFloat, 2);
        $net = bcsub(bcadd(bcadd($cashWithFloat, $methodCard, 2), $methodBank, 2), $expenses, 2);

        return [
            'cash' => $cashWithFloat,
            'card' => $methodCard,
            'bank' => $methodBank,
            'expenses' => $expenses,
            'net' => $net,
            'opening_float' => $openingFloat,
            'collections' => $collections,
            'refunds' => $refundsMagnitude,
            'payment_count' => $payments->count(),
            'expense_count' => $expenseCount,
            'by_method' => [
                'cash' => $methodCash,
                'card' => $methodCard,
                'bank' => $methodBank,
            ],
            'by_source' => [
                'subscriptions' => $subscriptions,
                'addons' => $addons,
                'pos' => $pos,
                'other' => $other,
                'refunds' => $refundsMagnitude,
                'expenses' => $expenses,
            ],
        ];
    }

    /**
     * Attach untagged payments/expenses that belong to this session's window or business day.
     */
    public function claimOrphanMoney(ShiftSession $session): void
    {
        $window = $this->window($session);
        // An untagged payment must belong to this session's actual time window.  Using
        // the whole business date here makes a later shift absorb the morning shift's
        // money (and is especially dangerous while the drawer is still open).
        Payment::query()
            ->whereNull('shift_session_id')
            ->where(function ($query) use ($window): void {
                $query->where(function ($time) use ($window): void {
                    $time
                        ->whereNotNull('paid_at')
                        ->whereBetween('paid_at', [$window['from'], $window['to']]);
                });
                // Legacy/imported payments can have no paid_at.  Their creation time
                // is the only safe timestamp available for assigning a shift.
                $query->orWhere(function ($created) use ($window): void {
                    $created
                        ->whereNull('paid_at')
                        ->whereBetween('created_at', [$window['from'], $window['to']]);
                });
            })
            ->update(['shift_session_id' => $session->id]);

        // Expense `date` is a business date, not a timestamp.  Use created_at to avoid
        // pulling all same-day expenses into whichever shift happens to be open now.
        Expense::query()
            ->whereNull('shift_session_id')
            ->whereBetween('created_at', [$window['from'], $window['to']])
            ->update(['shift_session_id' => $session->id]);
    }

    /**
     * @return array{from: Carbon, to: Carbon}
     */
    private function window(ShiftSession $session): array
    {
        $from = $session->opened_at?->copy() ?? $session->created_at?->copy() ?? now()->startOfDay();
        $to = $session->closed_at?->copy() ?? now();

        return [
            'from' => $from,
            'to' => $to,
        ];
    }
}
