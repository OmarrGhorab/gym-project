<?php

namespace App\Actions\Reports;

use App\Models\Employee;
use App\Models\MemberVisit;
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
        $memberIds = $addons->pluck('member_id')
            ->merge($studioSubscriptions->pluck('member_id'))
            ->filter()->unique()->all();

        $visits = MemberVisit::query()
            ->whereBetween('check_in_at', [$monthStart, $monthEnd])
            ->where(function ($q) use ($addonIds, $subscriptionIds, $memberIds): void {
                $q->whereIn('subscription_addon_id', $addonIds)
                    ->orWhereIn('subscription_id', $subscriptionIds)
                    ->orWhereIn('member_id', $memberIds);
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
        $totalRevenue = '0.00';
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
            $memberSet = array_flip($cMemberIds->all());

            $cVisits = $visits->filter(function ($v) use ($addonSet, $studioSet, $memberSet) {
                return ($v->subscription_addon_id && isset($addonSet[$v->subscription_addon_id]))
                    || ($v->subscription_id && isset($studioSet[$v->subscription_id]))
                    || ($v->member_id && isset($memberSet[$v->member_id]));
            });

            $cAttendedDates = $cVisits->map(fn ($v) => $v->check_in_at?->toDateString())->filter()->unique();
            $visitsByMember = $cVisits->groupBy('member_id');
            $cRevenue = $cAddons->sum(fn ($a) => (float) $a->price_paid) + $cStudio->sum(fn ($s) => (float) $s->price_paid);

            // Combine plan summaries
            $allCoachItems = collect();
            foreach ($cAddons as $a) {
                $allCoachItems->push([
                    'type' => 'addon',
                    'item' => $a,
                    'plan_id' => $a->plan_id,
                    'plan_name' => $a->plan?->name ?? 'Add-on Plan',
                    'category' => 'Extra-on',
                ]);
            }
            foreach ($cStudio as $s) {
                $allCoachItems->push([
                    'type' => 'studio',
                    'item' => $s,
                    'plan_id' => $s->plan_id,
                    'plan_name' => $s->plan?->name ?? 'Fitness Studio Plan',
                    'category' => $s->plan?->category === 'fitness_studio' ? 'Fitness Studio' : 'Main Plan',
                ]);
            }

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
                $mVisits = $visitsByMember->get($item->member_id, collect());
                $mAttendedDays = $mVisits->map(fn ($v) => $v->check_in_at?->toDateString())->filter()->unique()->count();
                $lastVisit = $mVisits->sortByDesc('check_in_at')->first()?->check_in_at?->toIso8601String();

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
                    'sessions_total' => (int) ($item->sessions_total ?? 0),
                    'sessions_remaining' => (int) ($item->sessions_remaining ?? 0),
                    'sessions_used' => max(0, (int) ($item->sessions_total ?? 0) - (int) ($item->sessions_remaining ?? 0)),
                    'attended_days_this_month' => $mAttendedDays,
                    'total_visits_this_month' => $mVisits->count(),
                    'last_visit_at' => $lastVisit,
                    'coach_name' => $coach->name,
                ];
            }

            $totalCoachedPlansCount += $allCoachItems->count();
            $totalRevenue = bcadd($totalRevenue, number_format($cRevenue, 2, '.', ''), 2);
            $allSubscribedMemberIds = $allSubscribedMemberIds->merge($cMemberIds);
            $allAttendedDates = $allAttendedDates->merge($cAttendedDates);

            $coachesData[] = [
                'coach_id' => $coach->id,
                'coach_name' => $coach->name,
                'coach_role' => $coach->role,
                'coach_phone' => $coach->phone,
                'active_addons_count' => $allCoachItems->where('item.status', 'active')->count(),
                'total_addons_count' => $allCoachItems->count(),
                'subscribed_members_count' => $cMemberIds->count(),
                'attended_days_count' => $cAttendedDates->count(),
                'total_visits_count' => $cVisits->count(),
                'total_revenue' => number_format($cRevenue, 2, '.', ''),
                'plans_summary' => $plansSummary,
                'members' => $membersList,
            ];
        }

        usort($coachesData, fn ($a, $b) => $b['subscribed_members_count'] <=> $a['subscribed_members_count']);

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
}
