<?php

namespace App\Actions\Reports;

use App\Models\Plan;
use App\Models\Subscription;
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

        if ($planId) {
            $plansQuery->where('id', $planId);
        }

        $plans = $plansQuery->get();

        $plansTable = $plans->map(function (Plan $plan) use ($from, $to): array {
            $periodSubs = Subscription::query()
                ->where('plan_id', $plan->id)
                ->whereBetween('created_at', [$from, $to]);

            $periodRevenue = (float) (clone $periodSubs)->sum('price_paid');
            $periodCount = (clone $periodSubs)->count();

            $expiringSoonCount = Subscription::query()
                ->where('plan_id', $plan->id)
                ->where('status', 'active')
                ->whereBetween('end_date', [now()->toDateString(), now()->addDays(7)->toDateString()])
                ->count();

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
            ->with(['member:id,name', 'plan:id,name', 'soldBy:id,name'])
            ->when($planId, fn ($q) => $q->where('plan_id', $planId))
            ->when($statusFilter, function ($q, $status) {
                if ($status === 'expiring_soon') {
                    $q->where('status', 'active')
                        ->whereBetween('end_date', [now()->toDateString(), now()->addDays(7)->toDateString()]);
                } else {
                    $q->where('status', $status);
                }
            })
            ->when(isset($params['from']) && isset($params['to']), fn ($q) => $q->whereBetween('created_at', [$from, $to]))
            ->latest();

        if ($subscriptionsQuery->count() === 0 && ! $statusFilter) {
            $subscriptionsQuery = Subscription::query()
                ->with(['member:id,name', 'plan:id,name', 'soldBy:id,name'])
                ->when($planId, fn ($q) => $q->where('plan_id', $planId))
                ->latest();
        }

        $totalActive = Subscription::query()->where('status', 'active')->count();
        $totalExpired = Subscription::query()->where('status', 'expired')->count();
        $totalExpiringSoon = Subscription::query()
            ->where('status', 'active')
            ->whereBetween('end_date', [now()->toDateString(), now()->addDays(7)->toDateString()])
            ->count();
        $periodNewSubs = Subscription::query()->whereBetween('created_at', [$from, $to])->count();
        $periodTotalRevenue = (float) Subscription::query()->whereBetween('created_at', [$from, $to])->sum('price_paid');

        $subscriptions = $subscriptionsQuery->limit(100)->get()->map(fn (Subscription $sub): array => [
            'id' => $sub->id,
            'member_name' => $sub->member?->name ?? 'Unknown Member',
            'plan_name' => $sub->plan?->name ?? 'Unknown Plan',
            'start_date' => $sub->start_date?->toDateString(),
            'end_date' => $sub->end_date?->toDateString(),
            'status' => $sub->status,
            'price_paid' => number_format((float) $sub->price_paid, 2, '.', ''),
            'sold_by' => $sub->soldBy?->name ?? 'System',
            'created_at' => $sub->created_at?->toIso8601String(),
        ])->values()->all();

        return [
            'totals' => [
                'active_members' => $totalActive,
                'expired_members' => $totalExpired,
                'expiring_soon' => $totalExpiringSoon,
                'new_subscriptions_period' => $periodNewSubs,
                'total_revenue_period' => number_format($periodTotalRevenue, 2, '.', ''),
            ],
            'plans_summary' => $plansTable,
            'subscriptions' => $subscriptions,
        ];
    }
}
