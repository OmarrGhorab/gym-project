<?php

namespace App\Actions\Reports;

use App\Actions\Reminders\FindExpiringSubscriptions;
use App\Models\Payment;
use App\Models\Subscription;
use App\Models\SubscriptionAddon;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;

/**
 * Single source of truth for membership / dashboard KPI totals.
 */
final class MembershipMetrics
{
    /**
     * @return array{
     *     active_subscriptions: int,
     *     frozen_subscriptions: int,
     *     expiring_soon: int,
     *     revenue_mtd: string,
     *     subscription_revenue_mtd: string,
     *     subscription_revenue_live: string,
     *     outstanding_dues_total: string,
     *     outstanding_dues_count: int
     * }
     */
    public function snapshot(?Carbon $now = null): array
    {
        $now ??= Carbon::now();
        $startOfMonth = $now->copy()->startOfMonth()->toDateTimeString();
        $endOfToday = $now->copy()->endOfDay()->toDateTimeString();

        $active = (int) Subscription::query()->where('status', 'active')->count();
        $frozen = (int) Subscription::query()->where('status', 'frozen')->count();
        $dues = $this->outstandingDues();

        return [
            'active_subscriptions' => $active,
            'frozen_subscriptions' => $frozen,
            'expiring_soon' => $this->expiringSoonCount($now),
            'revenue_mtd' => $this->money($this->paymentsTotalMtd(null, $startOfMonth, $endOfToday)),
            'subscription_revenue_mtd' => $this->money(
                $this->paymentsTotalMtd(
                    [Subscription::class, SubscriptionAddon::class],
                    $startOfMonth,
                    $endOfToday,
                ),
            ),
            'subscription_revenue_live' => $this->money($this->liveMembershipNetCollected()),
            'outstanding_dues_total' => $this->money($dues['total']),
            'outstanding_dues_count' => $dues['count'],
        ];
    }

    public function expiringSoonCount(?Carbon $now = null): int
    {
        $now ??= Carbon::now();
        $today = $now->copy()->startOfDay();
        $windowDays = max(1, (int) app(FindExpiringSubscriptions::class)->reminderDays());

        return (int) Subscription::query()
            ->where('status', 'active')
            ->withoutLaterActiveRenewal()
            ->whereBetween('end_date', [
                $today->toDateString(),
                $today->copy()->addDays($windowDays)->toDateString(),
            ])
            ->count();
    }

    /**
     * Net collected on currently active + frozen memberships (payments include refund negatives).
     */
    public function liveMembershipNetCollected(): float
    {
        $liveIds = Subscription::query()
            ->whereIn('status', ['active', 'frozen'])
            ->select('id');

        $base = (float) Payment::query()
            ->revenue()
            ->where('payable_type', Subscription::class)
            ->whereIn('payable_id', $liveIds)
            ->sum('amount');

        $addonIds = SubscriptionAddon::query()
            ->whereIn('subscription_id', $liveIds)
            ->select('id');

        $addons = (float) Payment::query()
            ->revenue()
            ->where('payable_type', SubscriptionAddon::class)
            ->whereIn('payable_id', $addonIds)
            ->sum('amount');

        return max(0.0, $base + $addons);
    }

    /**
     * @param  list<class-string>|null  $payableTypes
     */
    public function paymentsTotalMtd(?array $payableTypes, string $from, string $to): float
    {
        $query = Payment::query()
            ->revenue()
            ->whereBetween('paid_at', [$from, $to]);

        if ($payableTypes !== null) {
            $query->whereIn('payable_type', $payableTypes);
        }

        return (float) $query->sum('amount');
    }

    /**
     * Outstanding balances only on live (active/frozen) memberships.
     * Collected payments only (refund rows excluded from "paid toward package").
     *
     * @return array{total: float, count: int}
     */
    public function outstandingDues(): array
    {
        $rows = $this->duesQuery()->get();

        $total = 0.0;
        foreach ($rows as $subscription) {
            $total += $this->subscriptionBalance($subscription);
        }

        return [
            'total' => max(0.0, $total),
            'count' => $rows->count(),
        ];
    }

    /**
     * Base query for live dues rows with paid/price aggregates.
     *
     * @return Builder<Subscription>
     */
    public function duesQuery()
    {
        $subscriptionPaidTotals = Payment::query()
            ->selectRaw('payable_id, SUM(amount) as paid_total')
            ->where('payable_type', Subscription::class)
            ->whereIn('status', Payment::COLLECTED_STATUSES)
            ->groupBy('payable_id');

        $addonPaidTotals = Payment::query()
            ->join('subscription_addons', 'subscription_addons.id', '=', 'payments.payable_id')
            ->selectRaw('subscription_addons.subscription_id, SUM(payments.amount) as paid_total')
            ->where('payments.payable_type', SubscriptionAddon::class)
            ->whereIn('payments.status', Payment::COLLECTED_STATUSES)
            ->groupBy('subscription_addons.subscription_id');

        $addonPriceTotals = SubscriptionAddon::query()
            ->selectRaw('subscription_id, SUM(price_paid) as price_total')
            ->groupBy('subscription_id');

        return Subscription::query()
            ->with(['member', 'plan', 'soldBy'])
            ->leftJoinSub($subscriptionPaidTotals, 'subscription_paid_totals', 'subscription_paid_totals.payable_id', '=', 'subscriptions.id')
            ->leftJoinSub($addonPaidTotals, 'addon_paid_totals', 'addon_paid_totals.subscription_id', '=', 'subscriptions.id')
            ->leftJoinSub($addonPriceTotals, 'addon_price_totals', 'addon_price_totals.subscription_id', '=', 'subscriptions.id')
            ->select('subscriptions.*')
            ->selectRaw('COALESCE(subscription_paid_totals.paid_total, 0) as base_paid_total')
            ->selectRaw('COALESCE(addon_paid_totals.paid_total, 0) as addon_paid_total')
            ->selectRaw('COALESCE(addon_price_totals.price_total, 0) as addon_price_total')
            ->whereIn('subscriptions.status', ['active', 'frozen'])
            ->whereRaw('(subscriptions.price_paid + COALESCE(addon_price_totals.price_total, 0)) > (COALESCE(subscription_paid_totals.paid_total, 0) + COALESCE(addon_paid_totals.paid_total, 0))')
            ->orderBy('end_date');
    }

    public function subscriptionBalance(Subscription $subscription): float
    {
        $packagePrice = (float) $subscription->price_paid + (float) ($subscription->addon_price_total ?? 0);
        $paidTotal = (float) ($subscription->base_paid_total ?? 0) + (float) ($subscription->addon_paid_total ?? 0);

        return max($packagePrice - $paidTotal, 0.0);
    }

    private function money(float $amount): string
    {
        return number_format($amount, 2, '.', '');
    }
}
