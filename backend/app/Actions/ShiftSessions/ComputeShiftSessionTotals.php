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

        $expenseQuery = Expense::query()->where('shift_session_id', $session->id);
        $expenseCount = (int) (clone $expenseQuery)->count();
        $expenses = bcadd((string) $expenseQuery->sum('amount'), '0.00', 2);

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
    private function claimOrphanMoney(ShiftSession $session): void
    {
        $window = $this->window($session);
        $businessDate = $session->business_date?->toDateString()
            ?? $window['from']->toDateString();

        // Payments: explicit time window OR same business date while session is still open.
        Payment::query()
            ->whereNull('shift_session_id')
            ->where(function ($query) use ($window, $businessDate, $session): void {
                $query->where(function ($time) use ($window): void {
                    $time
                        ->whereNotNull('paid_at')
                        ->whereBetween('paid_at', [$window['from'], $window['to']]);
                });

                if ($session->status === ShiftSession::STATUS_OPEN) {
                    $query->orWhereDate('paid_at', $businessDate)
                        ->orWhereDate('created_at', $businessDate);
                }
            })
            ->update(['shift_session_id' => $session->id]);

        // Expenses: date is date-only (midnight), so never compare to opened_at datetime alone.
        Expense::query()
            ->whereNull('shift_session_id')
            ->where(function ($query) use ($window, $businessDate, $session): void {
                $query
                    ->whereBetween('created_at', [$window['from'], $window['to']])
                    ->orWhereDate('date', $businessDate)
                    ->orWhereDate('created_at', $businessDate);

                if ($session->status === ShiftSession::STATUS_OPEN) {
                    $query->orWhereDate('date', $window['from']->toDateString());
                }
            })
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
