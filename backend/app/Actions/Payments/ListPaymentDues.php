<?php

namespace App\Actions\Payments;

use App\Models\Payment;
use App\Models\Subscription;
use App\Models\SubscriptionAddon;

final class ListPaymentDues
{
    /** @return array{data: array, meta: array} */
    public function handle(): array
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

        $dues = Subscription::query()
            ->with(['member', 'plan', 'soldBy'])
            ->leftJoinSub($subscriptionPaidTotals, 'subscription_paid_totals', 'subscription_paid_totals.payable_id', '=', 'subscriptions.id')
            ->leftJoinSub($addonPaidTotals, 'addon_paid_totals', 'addon_paid_totals.subscription_id', '=', 'subscriptions.id')
            ->leftJoinSub($addonPriceTotals, 'addon_price_totals', 'addon_price_totals.subscription_id', '=', 'subscriptions.id')
            ->select('subscriptions.*')
            ->selectRaw('COALESCE(subscription_paid_totals.paid_total, 0) as base_paid_total')
            ->selectRaw('COALESCE(addon_paid_totals.paid_total, 0) as addon_paid_total')
            ->selectRaw('COALESCE(addon_price_totals.price_total, 0) as addon_price_total')
            ->whereRaw('(subscriptions.price_paid + COALESCE(addon_price_totals.price_total, 0)) > (COALESCE(subscription_paid_totals.paid_total, 0) + COALESCE(addon_paid_totals.paid_total, 0))')
            ->orderBy('end_date')
            ->paginate(15)
            ->withQueryString();

        $data = $dues->getCollection()->map(function (Subscription $subscription): array {
            $basePaid = (string) ($subscription->base_paid_total ?? '0.00');
            $addonPaid = (string) ($subscription->addon_paid_total ?? '0.00');
            $addonPrice = (string) ($subscription->addon_price_total ?? '0.00');
            $packagePrice = bcadd((string) $subscription->price_paid, $addonPrice, 2);
            $paid = bcadd($basePaid, $addonPaid, 2);
            $balance = bcsub($packagePrice, $paid, 2);

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
                'base_paid_total' => bcadd($basePaid, '0.00', 2),
                'addon_price_total' => bcadd($addonPrice, '0.00', 2),
                'addon_paid_total' => bcadd($addonPaid, '0.00', 2),
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
