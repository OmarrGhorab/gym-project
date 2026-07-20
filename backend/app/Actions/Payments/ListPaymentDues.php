<?php

namespace App\Actions\Payments;

use App\Actions\Reports\MembershipMetrics;
use App\Models\Subscription;

final class ListPaymentDues
{
    public function __construct(
        private readonly MembershipMetrics $metrics,
    ) {}

    /**
     * @return array{data: array<int, array<string, mixed>>, meta: array<string, mixed>}
     */
    public function handle(?int $perPage = null): array
    {
        $perPage = min(max($perPage ?? 50, 1), 200);

        $dues = $this->metrics->duesQuery()
            ->paginate($perPage)
            ->withQueryString();

        $totals = $this->metrics->outstandingDues();

        $data = $dues->getCollection()->map(function (Subscription $subscription): array {
            $basePaid = bcadd((string) ($subscription->base_paid_total ?? '0.00'), '0.00', 2);
            $addonPaid = bcadd((string) ($subscription->addon_paid_total ?? '0.00'), '0.00', 2);
            $addonPrice = bcadd((string) ($subscription->addon_price_total ?? '0.00'), '0.00', 2);
            $packagePrice = bcadd((string) $subscription->price_paid, $addonPrice, 2);
            $paid = bcadd($basePaid, $addonPaid, 2);
            $balance = bcsub($packagePrice, $paid, 2);

            if (bccomp($balance, '0.00', 2) === -1) {
                $balance = '0.00';
            }

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
                'price_paid' => $packagePrice,
                'base_price_paid' => $subscription->price_paid,
                'base_paid_total' => $basePaid,
                'addon_price_total' => $addonPrice,
                'addon_paid_total' => $addonPaid,
            ];
        })->values()->all();

        return [
            'data' => $data,
            'meta' => [
                'current_page' => $dues->currentPage(),
                'per_page' => $dues->perPage(),
                'total' => $dues->total(),
                'last_page' => $dues->lastPage(),
                // Authoritative full totals (not just this page).
                'outstanding_dues_total' => number_format($totals['total'], 2, '.', ''),
                'outstanding_dues_count' => $totals['count'],
            ],
        ];
    }
}
