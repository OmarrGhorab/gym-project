<?php

namespace App\Actions\Reports;

use App\Models\Employee;
use App\Models\MemberVisit;
use App\Models\Payment;
use App\Models\Subscription;
use App\Models\SubscriptionAddon;
use Carbon\CarbonImmutable;

final class CoachExtraPlansReport
{
    /**
     * @param  array{from?: string|null, to?: string|null, coach_id?: int|string|null}  $params
     * @return array<string, mixed>
     */
    public function execute(array $params = []): array
    {
        $now = CarbonImmutable::now();
        $monthStart = CarbonImmutable::parse($params['from'] ?? $now->startOfMonth())->startOfDay();
        $monthEnd = CarbonImmutable::parse($params['to'] ?? $now->endOfMonth())->endOfDay();
        $coachIdFilter = ! empty($params['coach_id']) ? (int) $params['coach_id'] : null;

        // Fetch Extra Add-on Plans
        $addonQuery = SubscriptionAddon::query()
            ->with([
                'coach:id,name,role,phone',
                'member:id,name,attendance_code,phone',
                'plan:id,name,category',
                'payments:id,payable_type,payable_id,amount,status,paid_at',
                'subscription:id,plan_id,price_paid',
                'subscription.plan:id,name',
                'subscription.payments:id,payable_type,payable_id,amount,status,paid_at',
            ])
            ->where(function ($q) use ($monthStart, $monthEnd): void {
                $q->whereBetween('created_at', [$monthStart, $monthEnd])
                    ->orWhere(function ($plans) use ($monthStart, $monthEnd): void {
                        $plans
                            ->whereDate('start_date', '<=', $monthEnd->toDateString())
                            ->whereDate('end_date', '>=', $monthStart->toDateString());
                    });
            });

        if ($coachIdFilter) {
            $addonQuery->where('coach_id', $coachIdFilter);
        }

        $addons = $addonQuery->get();

        // Fetch Fitness Studio & Coached Main Subscriptions
        $studioQuery = Subscription::query()
            ->with([
                'coach:id,name,role,phone',
                'member:id,name,attendance_code,phone',
                'plan:id,name,category',
                'payments:id,payable_type,payable_id,amount,status,paid_at',
            ])
            ->where(function ($q): void {
                $q->whereNotNull('coach_id')
                    ->orWhereHas('plan', function ($p): void {
                        $p->where('category', 'fitness_studio');
                    });
            })
            ->where(function ($q) use ($monthStart, $monthEnd): void {
                $q->whereBetween('created_at', [$monthStart, $monthEnd])
                    ->orWhere(function ($plans) use ($monthStart, $monthEnd): void {
                        $plans
                            ->whereDate('start_date', '<=', $monthEnd->toDateString())
                            ->whereDate('end_date', '>=', $monthStart->toDateString());
                    });
            });

        if ($coachIdFilter) {
            $studioQuery->where('coach_id', $coachIdFilter);
        }

        $studioSubscriptions = $studioQuery->get();

        $addonIds = $addons->pluck('id')->filter()->all();
        $subscriptionIds = $studioSubscriptions->pluck('id')->filter()->all();
        $visits = MemberVisit::query()
            ->whereBetween('check_in_at', [$monthStart, $monthEnd])
            ->where(function ($q) use ($addonIds, $subscriptionIds): void {
                $q->whereIn('subscription_addon_id', $addonIds)
                    ->orWhereIn('subscription_id', $subscriptionIds);
            })
            ->get(['id', 'member_id', 'subscription_id', 'subscription_addon_id', 'check_in_at']);

        $addonsGroupedByCoach = $addons->groupBy('coach_id');
        $studioGroupedByCoach = $studioSubscriptions->groupBy('coach_id');

        $coachesQuery = Employee::query()->active();
        if ($coachIdFilter) {
            $coachesQuery->where('id', $coachIdFilter);
        } else {
            $coachesQuery->where(function ($q): void {
                $q->whereRaw("LOWER(role) LIKE '%coach%'")
                    ->orWhereRaw("LOWER(role) LIKE '%captain%'")
                    ->orWhereRaw("LOWER(role) LIKE '%trainer%'")
                    ->orWhereRaw("LOWER(role) LIKE '%pt%'");
            });
        }
        $allCoaches = $coachesQuery->get(['id', 'name', 'role', 'phone'])->keyBy('id');

        if ($allCoaches->isEmpty() && ! $coachIdFilter) {
            $allCoaches = Employee::query()->active()->get(['id', 'name', 'role', 'phone'])->keyBy('id');
        }

        // Include any coach associated with addons or studio subscriptions
        $allCoachIds = $addonsGroupedByCoach->keys()->merge($studioGroupedByCoach->keys())->filter()->unique();
        foreach ($allCoachIds as $cId) {
            if ($cId && ! $allCoaches->has($cId)) {
                $coachModel = $addonsGroupedByCoach->get($cId)?->first()?->coach
                    ?? $studioGroupedByCoach->get($cId)?->first()?->coach
                    ?? Employee::query()->find($cId, ['id', 'name', 'role', 'phone']);

                if ($coachModel) {
                    $allCoaches->put($cId, $coachModel);
                }
            }
        }

        $coachesData = [];
        $totalCoachedPlansCount = 0;
        $allRevenueSources = collect();
        $allSubscribedMemberIds = collect();
        $allAttendedDates = collect();

        foreach ($allCoaches as $cId => $coach) {
            $cAddons = $addonsGroupedByCoach->get($cId, collect());
            $cStudio = $studioGroupedByCoach->get($cId, collect());

            $cMemberIds = $cAddons->pluck('member_id')
                ->merge($cStudio->pluck('member_id'))
                ->filter()->unique();

            $cAddonIds = $cAddons->pluck('id')->filter();
            $cStudioIds = $cStudio->pluck('id')->filter();

            $addonSet = array_flip($cAddonIds->all());
            $studioSet = array_flip($cStudioIds->all());
            $cVisits = $visits->filter(function ($v) use ($addonSet, $studioSet) {
                return ($v->subscription_addon_id && isset($addonSet[$v->subscription_addon_id]))
                    || ($v->subscription_id && isset($studioSet[$v->subscription_id]));
            });

            $cAttendedDates = $cVisits->map(fn ($v) => $v->check_in_at?->toDateString())->filter()->unique();
            // Combine plan summaries
            $allCoachItems = collect();
            foreach ($cAddons as $a) {
                $payment = $this->paymentContext($a);
                $allCoachItems->push([
                    'type' => 'addon',
                    'item' => $a,
                    'plan_id' => $a->plan_id,
                    'plan_name' => $a->plan?->name ?? 'Add-on Plan',
                    'category' => 'Extra-on',
                    ...$payment,
                ]);
            }
            foreach ($cStudio as $s) {
                $payment = $this->paymentContext($s);
                $allCoachItems->push([
                    'type' => 'studio',
                    'item' => $s,
                    'plan_id' => $s->plan_id,
                    'plan_name' => $s->plan?->name ?? 'Fitness Studio Plan',
                    'category' => $s->plan?->category === 'fitness_studio' ? 'Fitness Studio' : 'Main Plan',
                    ...$payment,
                ]);
            }

            $revenueSources = $allCoachItems
                ->map(fn (array $wrapped): array => [
                    'key' => $wrapped['payment_key'],
                    'amount' => $wrapped['paid_amount'],
                ])
                ->unique('key')
                ->values();
            $cRevenue = $revenueSources->reduce(
                fn (string $total, array $source): string => bcadd($total, $source['amount'], 2),
                '0.00',
            );
            $activeCoachItems = $allCoachItems->filter(
                fn (array $wrapped): bool => $wrapped['item']->status === 'active',
            );
            $activeMemberIds = $activeCoachItems
                ->pluck('item.member_id')
                ->filter()
                ->unique();

            $plansSummary = $allCoachItems->groupBy('plan_id')->map(function ($items) {
                $first = $items->first();

                return [
                    'plan_id' => $first['plan_id'],
                    'plan_name' => $first['plan_name'],
                    'category' => $first['category'],
                    'count' => $items->count(),
                ];
            })->values()->all();

            $membersList = [];
            foreach ($allCoachItems as $wrapped) {
                $item = $wrapped['item'];
                $mVisits = $visits->filter(function (MemberVisit $visit) use ($item, $wrapped): bool {
                    if ($wrapped['type'] === 'addon') {
                        return (int) $visit->subscription_addon_id === (int) $item->id;
                    }

                    return (int) $visit->subscription_id === (int) $item->id
                        && $visit->subscription_addon_id === null;
                });
                $mAttendedDays = $mVisits->map(fn ($v) => $v->check_in_at?->toDateString())->filter()->unique()->count();
                $lastVisit = $mVisits->sortByDesc('check_in_at')->first()?->check_in_at?->toIso8601String();
                $attendanceDates = $mVisits
                    ->map(fn (MemberVisit $visit): ?string => $visit->check_in_at?->toDateString())
                    ->filter()
                    ->countBy()
                    ->sortKeys()
                    ->map(fn (int $count, string $date): array => ['date' => $date, 'visits' => $count])
                    ->values()
                    ->all();
                $paymentRows = $item->payments;
                if ($wrapped['payment_source'] === 'parent_package' && $item instanceof SubscriptionAddon) {
                    $paymentRows = $item->subscription?->payments ?? collect();
                }
                $revenuePaymentRows = $paymentRows
                    ->filter(fn (Payment $payment): bool => in_array($payment->status, Payment::REVENUE_STATUSES, true))
                    ->sortBy('paid_at');
                $paymentDates = $revenuePaymentRows
                    ->map(fn (Payment $payment): ?string => $payment->paid_at?->toDateString())
                    ->filter()
                    ->unique()
                    ->sort()
                    ->values()
                    ->all();
                $paymentBreakdown = $revenuePaymentRows
                    ->map(fn (Payment $payment): array => [
                        'id' => $payment->id,
                        'date' => $payment->paid_at?->toDateString(),
                        'amount' => number_format((float) $payment->amount, 2, '.', ''),
                        'status' => $payment->status,
                    ])
                    ->values()
                    ->all();
                $sessionsTotal = (int) ($item->sessions_total ?? 0);
                $sessionsRemaining = (int) ($item->sessions_remaining ?? 0);

                $membersList[] = [
                    'addon_id' => $item->id,
                    'type' => $wrapped['type'],
                    'member_id' => $item->member_id,
                    'member_name' => $item->member?->name ?? 'Member #'.$item->member_id,
                    'member_code' => $item->member?->attendance_code ?? '',
                    'member_phone' => $item->member?->phone ?? '',
                    'plan_name' => $item->plan?->name ?? 'Coached Plan',
                    'plan_category' => $wrapped['category'],
                    'start_date' => $item->start_date?->toDateString(),
                    'end_date' => $item->end_date?->toDateString(),
                    'status' => $item->status,
                    'price_paid' => number_format((float) $item->price_paid, 2, '.', ''),
                    'paid_amount' => $wrapped['paid_amount'],
                    'payment_source' => $wrapped['payment_source'],
                    'payment_plan_name' => $wrapped['payment_plan_name'],
                    'payment_price' => $wrapped['payment_price'],
                    'payment_dates' => $paymentDates,
                    'payment_breakdown' => $paymentBreakdown,
                    'sessions_total' => $sessionsTotal,
                    'sessions_remaining' => $sessionsRemaining,
                    // Counting visits overstates this: a blocked visit never consumed a
                    // session, a duplicate scan refunds the visit it reverses, and a
                    // pending review consumes nothing until approved. The ledger is the
                    // only figure that stays consistent with "left".
                    //
                    // Only while the row is active, though: cancelling or stopping sets
                    // sessions_remaining to 0 administratively (see StopSubscription), so
                    // total - remaining would report a refunded plan as fully consumed.
                    'sessions_used' => $item->status === 'active' && $sessionsTotal > 0
                        ? max(0, $sessionsTotal - $sessionsRemaining)
                        : 0,
                    'attended_days_this_month' => $mAttendedDays,
                    'total_visits_this_month' => $mVisits->count(),
                    'attendance_dates' => $attendanceDates,
                    'last_visit_at' => $lastVisit,
                    'coach_name' => $coach->name,
                ];
            }

            $totalCoachedPlansCount += $activeCoachItems->count();
            $allRevenueSources = $allRevenueSources->merge($revenueSources);
            $allSubscribedMemberIds = $allSubscribedMemberIds->merge($activeMemberIds);
            $allAttendedDates = $allAttendedDates->merge($cAttendedDates);

            $coachesData[] = [
                'coach_id' => $coach->id,
                'coach_name' => $coach->name,
                'coach_role' => $coach->role,
                'coach_phone' => $coach->phone,
                'active_addons_count' => $activeCoachItems->count(),
                'total_addons_count' => $allCoachItems->count(),
                'subscribed_members_count' => $activeMemberIds->count(),
                'subscription_rows_count' => $allCoachItems->count(),
                'stopped_subscriptions_count' => $allCoachItems->where('item.status', 'stopped')->count(),
                'attended_days_count' => $cAttendedDates->count(),
                'total_visits_count' => $cVisits->count(),
                'total_revenue' => $cRevenue,
                'plans_summary' => $plansSummary,
                'members' => $membersList,
            ];
        }

        usort($coachesData, fn ($a, $b) => $b['subscribed_members_count'] <=> $a['subscribed_members_count']);
        $totalRevenue = $allRevenueSources
            ->unique('key')
            ->reduce(
                fn (string $total, array $source): string => bcadd($total, $source['amount'], 2),
                '0.00',
            );

        return [
            'generated_at' => $now->toIso8601String(),
            'period' => [
                'from' => $monthStart->toDateString(),
                'to' => $monthEnd->toDateString(),
            ],
            'kpis' => [
                'total_coached_addons' => $totalCoachedPlansCount,
                'total_subscribed_members' => $allSubscribedMemberIds->unique()->count(),
                'total_attended_days' => $allAttendedDates->unique()->count(),
                'total_addon_revenue' => $totalRevenue,
            ],
            'coaches' => $coachesData,
        ];
    }

    /**
     * @return array{
     *     paid_amount: string,
     *     payment_key: string,
     *     payment_source: 'direct'|'parent_package',
     *     payment_plan_name: string,
     *     payment_price: string
     * }
     */
    private function paymentContext(Subscription|SubscriptionAddon $item): array
    {
        $revenuePayments = $item->payments
            ->filter(fn (Payment $payment): bool => in_array($payment->status, Payment::REVENUE_STATUSES, true));

        if (
            $item instanceof SubscriptionAddon
            && $revenuePayments->isEmpty()
            && bccomp((string) $item->price_paid, '0.00', 2) === 0
            && $item->subscription !== null
        ) {
            return [
                'paid_amount' => $this->netPaymentsOrPrice(
                    $item->subscription->payments->filter(
                        fn (Payment $payment): bool => in_array($payment->status, Payment::REVENUE_STATUSES, true),
                    ),
                    (string) $item->subscription->price_paid,
                ),
                'payment_key' => 'subscription:'.$item->subscription->id,
                'payment_source' => 'parent_package',
                'payment_plan_name' => $item->subscription->plan?->name ?? 'Parent package',
                'payment_price' => number_format((float) $item->subscription->price_paid, 2, '.', ''),
            ];
        }

        return [
            'paid_amount' => $this->netPaymentsOrPrice($revenuePayments, (string) $item->price_paid),
            'payment_key' => $item instanceof Subscription
                ? 'subscription:'.$item->id
                : 'subscription_addon:'.$item->id,
            'payment_source' => 'direct',
            'payment_plan_name' => $item->plan?->name ?? 'Coached plan',
            'payment_price' => number_format((float) $item->price_paid, 2, '.', ''),
        ];
    }

    private function netPaymentsOrPrice($payments, string $fallbackPrice): string
    {
        if ($payments->isEmpty()) {
            return number_format((float) $fallbackPrice, 2, '.', '');
        }

        return $payments->reduce(
            fn (string $total, Payment $payment): string => bcadd($total, (string) $payment->amount, 2),
            '0.00',
        );
    }
}
