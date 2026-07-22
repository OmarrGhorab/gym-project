<?php

namespace App\Actions\Reports;

use App\Models\Employee;
use App\Models\MemberVisit;
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

        $query = SubscriptionAddon::query()
            ->with([
                'coach:id,name,role,phone',
                'member:id,name,attendance_code,phone',
                'plan:id,name',
            ])
            ->where(function ($q) use ($monthStart, $monthEnd): void {
                $q->whereBetween('start_date', [$monthStart->toDateString(), $monthEnd->toDateString()])
                    ->orWhereBetween('created_at', [$monthStart, $monthEnd])
                    ->orWhere(function ($active): void {
                        $active->where('status', 'active');
                    });
            });

        if ($coachIdFilter) {
            $query->where('coach_id', $coachIdFilter);
        }

        $addons = $query->get();

        $addonIds = $addons->pluck('id')->filter()->all();
        $memberIds = $addons->pluck('member_id')->filter()->unique()->all();

        $visits = MemberVisit::query()
            ->whereBetween('check_in_at', [$monthStart, $monthEnd])
            ->where(function ($q) use ($addonIds, $memberIds): void {
                $q->whereIn('subscription_addon_id', $addonIds)
                    ->orWhereIn('member_id', $memberIds);
            })
            ->get(['id', 'member_id', 'subscription_id', 'subscription_addon_id', 'check_in_at']);

        $groupedByCoach = $addons->groupBy('coach_id');

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

        foreach ($groupedByCoach as $cId => $coachAddons) {
            if ($cId && ! $allCoaches->has($cId)) {
                $coachModel = $coachAddons->first()?->coach ?? Employee::query()->find($cId, ['id', 'name', 'role', 'phone']);
                if ($coachModel) {
                    $allCoaches->put($cId, $coachModel);
                }
            }
        }

        $coachesData = [];
        $totalAddonsCount = 0;
        $totalRevenue = '0.00';
        $allSubscribedMemberIds = collect();
        $allAttendedDates = collect();

        foreach ($allCoaches as $cId => $coach) {
            $cAddons = $groupedByCoach->get($cId, collect());
            $cMemberIds = $cAddons->pluck('member_id')->filter()->unique();
            $cAddonIds = $cAddons->pluck('id')->filter();

            $cVisits = $visits->filter(function ($v) use ($cAddonIds, $cMemberIds) {
                return ($v->subscription_addon_id && $cAddonIds->contains($v->subscription_addon_id))
                    || ($v->member_id && $cMemberIds->contains($v->member_id));
            });

            $cAttendedDates = $cVisits->map(fn ($v) => $v->check_in_at?->toDateString())->filter()->unique();
            $cRevenue = $cAddons->sum(fn ($a) => (float) $a->price_paid);

            $plansSummary = $cAddons->groupBy('plan_id')->map(function ($planAddons) {
                $first = $planAddons->first();

                return [
                    'plan_id' => $first?->plan_id,
                    'plan_name' => $first?->plan?->name ?? 'Add-on Plan',
                    'count' => $planAddons->count(),
                ];
            })->values()->all();

            $membersList = $cAddons->map(function ($addon) use ($cVisits): array {
                $mVisits = $cVisits->where('member_id', $addon->member_id);
                $mAttendedDays = $mVisits->map(fn ($v) => $v->check_in_at?->toDateString())->filter()->unique()->count();
                $lastVisit = $mVisits->sortByDesc('check_in_at')->first()?->check_in_at?->toIso8601String();

                return [
                    'addon_id' => $addon->id,
                    'member_id' => $addon->member_id,
                    'member_name' => $addon->member?->name ?? 'Member #'.$addon->member_id,
                    'member_code' => $addon->member?->attendance_code ?? '',
                    'member_phone' => $addon->member?->phone ?? '',
                    'plan_name' => $addon->plan?->name ?? 'Add-on Plan',
                    'start_date' => $addon->start_date?->toDateString(),
                    'end_date' => $addon->end_date?->toDateString(),
                    'status' => $addon->status,
                    'price_paid' => number_format((float) $addon->price_paid, 2, '.', ''),
                    'sessions_total' => (int) $addon->sessions_total,
                    'sessions_remaining' => (int) $addon->sessions_remaining,
                    'sessions_used' => max(0, (int) $addon->sessions_total - (int) $addon->sessions_remaining),
                    'attended_days_this_month' => $mAttendedDays,
                    'total_visits_this_month' => $mVisits->count(),
                    'last_visit_at' => $lastVisit,
                ];
            })->values()->all();

            $totalAddonsCount += $cAddons->count();
            $totalRevenue = bcadd($totalRevenue, number_format($cRevenue, 2, '.', ''), 2);
            $allSubscribedMemberIds = $allSubscribedMemberIds->merge($cMemberIds);
            $allAttendedDates = $allAttendedDates->merge($cAttendedDates);

            $coachesData[] = [
                'coach_id' => $coach->id,
                'coach_name' => $coach->name,
                'coach_role' => $coach->role,
                'coach_phone' => $coach->phone,
                'active_addons_count' => $cAddons->where('status', 'active')->count(),
                'total_addons_count' => $cAddons->count(),
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
                'total_coached_addons' => $totalAddonsCount,
                'total_subscribed_members' => $allSubscribedMemberIds->unique()->count(),
                'total_attended_days' => $allAttendedDates->unique()->count(),
                'total_addon_revenue' => $totalRevenue,
            ],
            'coaches' => $coachesData,
        ];
    }
}
