<?php

namespace App\Actions\Reports;

use App\Models\Plan;
use App\Models\Subscription;
use App\Models\SubscriptionAddon;
use Carbon\Carbon;

final class ClassesPlansReport
{
    /**
     * @param  array<string, mixed>  $params
     * @return array<string, mixed>
     */
    public function execute(array $params = []): array
    {
        $from = Carbon::parse($params['from'] ?? now()->startOfMonth()->toDateString())->startOfDay();
        $to = Carbon::parse($params['to'] ?? now()->toDateString())->endOfDay();
        $planId = isset($params['plan_id']) && $params['plan_id'] !== '' ? (int) $params['plan_id'] : null;
        $statusFilter = $params['status'] ?? null;

        $plansQuery = Plan::query()->withCount([
            'subscriptions as active_subscriptions_count' => fn ($q) => $q->where('status', 'active'),
            'subscriptions as stopped_subscriptions_count' => fn ($q) => $q->where('status', 'stopped'),
            'subscriptions as expired_subscriptions_count' => fn ($q) => $q->where('status', 'expired'),
        ]);

        // The plans table doubles as the picker for the plan focus filter, so it
        // always lists every plan — narrowing it to $planId would leave the UI
        // with no way to switch to another plan once one is selected.
        $plans = $plansQuery->get();

        // Extra services are sold as their own plan on a separate table, so counting
        // subscriptions alone hid every add-on sale — both from the extra's own plan
        // row and from the period total.
        $periodStats = Subscription::query()
            ->whereBetween('created_at', [$from, $to])
            ->groupBy('plan_id')
            ->selectRaw('plan_id, COUNT(*) as c, SUM(price_paid) as rev')
            ->toBase()
            ->get()
            ->keyBy('plan_id');

        $addonPeriodStats = SubscriptionAddon::query()
            ->whereBetween('created_at', [$from, $to])
            ->groupBy('plan_id')
            ->selectRaw('plan_id, COUNT(*) as c, SUM(price_paid) as rev')
            ->toBase()
            ->get()
            ->keyBy('plan_id');

        $expiringSoon = Subscription::query()
            ->where('status', 'active')
            ->where(function ($q) {
                $q->whereBetween('end_date', [now()->toDateString(), now()->addDays(7)->toDateString()])
                    ->orWhere(function ($sq) {
                        $sq->whereNotNull('sessions_total')
                            ->where('sessions_total', '>', 0)
                            ->where('sessions_remaining', '<=', 3);
                    });
            })
            ->groupBy('plan_id')
            ->selectRaw('plan_id, COUNT(*) as c')
            ->toBase()
            ->get()
            ->pluck('c', 'plan_id');

        $plansTable = $plans->map(function (Plan $plan) use ($periodStats, $addonPeriodStats, $expiringSoon): array {
            $periodRevenue = (float) ($periodStats->get($plan->id)?->rev ?? 0)
                + (float) ($addonPeriodStats->get($plan->id)?->rev ?? 0);
            $periodCount = (int) ($periodStats->get($plan->id)?->c ?? 0)
                + (int) ($addonPeriodStats->get($plan->id)?->c ?? 0);

            $expiringSoonCount = (int) ($expiringSoon[$plan->id] ?? 0);

            return [
                'id' => $plan->id,
                'name' => $plan->name,
                'price' => number_format((float) $plan->price, 2, '.', ''),
                'duration_days' => $plan->duration_days,
                'active_members' => $plan->active_subscriptions_count,
                'expired_members' => $plan->expired_subscriptions_count,
                'expiring_soon' => $expiringSoonCount,
                'new_subscriptions_period' => $periodCount,
                'revenue_period' => number_format($periodRevenue, 2, '.', ''),
            ];
        })->values()->all();

        $subscriptionsQuery = Subscription::query()
            ->with(['member:id,name,phone', 'plan:id,name', 'soldBy:id,name'])
            ->when($planId, fn ($q) => $q->where('plan_id', $planId))
            ->when($statusFilter, function ($q, $status) {
                if ($status === 'expiring_soon') {
                    $q->where('status', 'active')
                        ->whereBetween('end_date', [now()->toDateString(), now()->addDays(7)->toDateString()]);
                } elseif ($status === 'low_sessions') {
                    $q->where('status', 'active')
                        ->whereNotNull('sessions_total')
                        ->where('sessions_total', '>', 0)
                        ->where('sessions_remaining', '<=', 3);
                } elseif ($status === 'ending_soon') {
                    $q->where('status', 'active')
                        ->where(function ($sq) {
                            $sq->whereBetween('end_date', [now()->toDateString(), now()->addDays(7)->toDateString()])
                                ->orWhere(function ($ssq) {
                                    $ssq->whereNotNull('sessions_total')
                                        ->where('sessions_total', '>', 0)
                                        ->where('sessions_remaining', '<=', 3);
                                });
                        });
                } else {
                    $q->where('status', $status);
                }
            })
            ->when(isset($params['from']) && isset($params['to']), fn ($q) => $q->whereBetween('created_at', [$from, $to]))
            ->latest();

        if ($subscriptionsQuery->count() === 0 && ! $statusFilter && ! isset($params['from'], $params['to'])) {
            $subscriptionsQuery = Subscription::query()
                ->with(['member:id,name,phone', 'plan:id,name', 'soldBy:id,name'])
                ->when($planId, fn ($q) => $q->where('plan_id', $planId))
                ->latest();
        }

        $totalActive = Subscription::query()->where('status', 'active')->count();
        $totalExpired = Subscription::query()->where('status', 'expired')->count();
        $totalExpiringSoon = Subscription::query()
            ->where('status', 'active')
            ->whereBetween('end_date', [now()->toDateString(), now()->addDays(7)->toDateString()])
            ->count();
        $totalLowSessions = Subscription::query()
            ->where('status', 'active')
            ->whereNotNull('sessions_total')
            ->where('sessions_total', '>', 0)
            ->where('sessions_remaining', '<=', 3)
            ->count();

        $periodNewSubs = Subscription::query()->whereBetween('created_at', [$from, $to])->count();
        $periodTotalRevenue = (float) Subscription::query()->whereBetween('created_at', [$from, $to])->sum('price_paid')
            + (float) SubscriptionAddon::query()->whereBetween('created_at', [$from, $to])->sum('price_paid');

        $formatSub = function (Subscription $sub): array {
            $daysLeft = $sub->end_date ? (int) Carbon::today()->diffInDays($sub->end_date, false) : null;
            $hasLowSessions = $sub->sessions_total !== null && $sub->sessions_total > 0 && $sub->sessions_remaining <= 3;
            $isExpiringSoon = $daysLeft !== null && $daysLeft >= 0 && $daysLeft <= 7;

            $attentionReason = 'normal';
            if ($sub->status === 'expired' || ($daysLeft !== null && $daysLeft < 0)) {
                $attentionReason = 'expired';
            } elseif ($hasLowSessions && $isExpiringSoon) {
                $attentionReason = 'both';
            } elseif ($hasLowSessions) {
                $attentionReason = 'low_sessions';
            } elseif ($isExpiringSoon) {
                $attentionReason = 'expiring_soon';
            }

            return [
                'id' => $sub->id,
                'member_name' => $sub->member?->name ?? 'Unknown Member',
                'member_phone' => $sub->member?->phone,
                'plan_name' => $sub->plan?->name ?? 'Unknown Plan',
                'start_date' => $sub->start_date?->toDateString(),
                'end_date' => $sub->end_date?->toDateString(),
                'days_left' => $daysLeft,
                'sessions_remaining' => $sub->sessions_remaining,
                'sessions_total' => $sub->sessions_total,
                'sessions_text' => $sub->sessions_total !== null && $sub->sessions_total > 0
                    ? "{$sub->sessions_remaining} / {$sub->sessions_total}"
                    : 'Unlimited',
                'status' => $sub->status,
                'attention_reason' => $attentionReason,
                'price_paid' => number_format((float) $sub->price_paid, 2, '.', ''),
                'sold_by' => $sub->soldBy?->name ?? 'System',
                'created_at' => $sub->created_at?->toIso8601String(),
            ];
        };

        // Focusing a single plan is a "show me everyone on this plan" request, so it
        // gets a bigger window than the general browse list.
        $subscriptionsTotal = $subscriptionsQuery->clone()->count();
        $subscriptions = $subscriptionsQuery->limit($planId ? 500 : 100)->get()->map($formatSub)->values()->all();

        $endingSoonList = Subscription::query()
            ->with(['member:id,name,phone', 'plan:id,name', 'soldBy:id,name'])
            ->where('status', 'active')
            ->where(function ($q) {
                $q->whereBetween('end_date', [now()->toDateString(), now()->addDays(7)->toDateString()])
                    ->orWhere(function ($sq) {
                        $sq->whereNotNull('sessions_total')
                            ->where('sessions_total', '>', 0)
                            ->where('sessions_remaining', '<=', 3);
                    });
            })
            ->when($planId, fn ($q) => $q->where('plan_id', $planId))
            ->latest('end_date')
            ->get()
            ->map($formatSub)
            ->values()
            ->all();

        return [
            'totals' => [
                'active_members' => $totalActive,
                'expired_members' => $totalExpired,
                'expiring_soon' => $totalExpiringSoon,
                'low_sessions' => $totalLowSessions,
                'ending_soon_total' => count($endingSoonList),
                'new_subscriptions_period' => $periodNewSubs,
                'total_revenue_period' => number_format($periodTotalRevenue, 2, '.', ''),
            ],
            'plans_summary' => $plansTable,
            'ending_soon_members' => $endingSoonList,
            'subscriptions' => $subscriptions,
            'subscriptions_total' => $subscriptionsTotal,
            'selected_plan_id' => $planId,
        ];
    }
}
