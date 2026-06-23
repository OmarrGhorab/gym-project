<?php

namespace App\Actions\Payments;

use App\Models\Payment;
use App\Models\Subscription;

final class ListPaymentDues
{
    /** @return array{data: array, meta: array} */
    public function handle(): array
    {
        $paidTotals = Payment::query()
            ->selectRaw('payable_id, SUM(amount) as paid_total')
            ->where('payable_type', Subscription::class)
            ->groupBy('payable_id');

        $dues = Subscription::query()
            ->with(['member', 'plan', 'soldBy'])
            ->leftJoinSub($paidTotals, 'paid_totals', 'paid_totals.payable_id', '=', 'subscriptions.id')
            ->select('subscriptions.*')
            ->selectRaw('COALESCE(paid_totals.paid_total, 0) as paid_total')
            ->whereRaw('subscriptions.price_paid > COALESCE(paid_totals.paid_total, 0)')
            ->orderBy('end_date')
            ->paginate(15)
            ->withQueryString();

        $data = $dues->getCollection()->map(function (Subscription $subscription): array {
            $paid = bcadd((string) ($subscription->paid_total ?? '0.00'), '0.00', 2);
            $balance = bcsub((string) $subscription->price_paid, $paid, 2);

            return [
                'subscription' => [
                    'id' => $subscription->id,
                    'status' => $subscription->status,
                    'start_date' => $subscription->start_date?->toDateString(),
                    'end_date' => $subscription->end_date?->toDateString(),
                ],
                'member' => [
                    'id' => $subscription->member?->id,
                    'name' => $subscription->member?->name,
                ],
                'balance' => $balance,
                'paid_total' => $paid,
                'price_paid' => $subscription->price_paid,
            ];
        })->values();

        return [
            'data' => $data,
            'meta' => [
                'current_page' => $dues->currentPage(),
                'per_page' => $dues->perPage(),
                'total' => $dues->total(),
                'last_page' => $dues->lastPage(),
            ],
        ];
    }
}
