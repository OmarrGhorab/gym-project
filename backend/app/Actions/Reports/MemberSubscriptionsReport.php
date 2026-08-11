<?php

namespace App\Actions\Reports;

use App\Models\Member;
use App\Models\MemberVisit;
use App\Models\Payment;
use App\Models\Subscription;
use App\Models\SubscriptionAddon;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Collection;

/**
 * Member subscription report: one row per member built from their latest
 * subscription (attendance, money, plan window, staff), plus the full
 * subscription history for a single member when `member_id` is supplied.
 */
final class MemberSubscriptionsReport
{
    private const DEFAULT_LIMIT = 500;

    private const MAX_LIMIT = 2000;

    /** Visits manually marked blocked never happened, so they are not attendance. */
    private const NON_ATTENDED_VISIT_STATUSES = ['blocked'];

    /**
     * @var list<string>
     */
    private const RELATIONS = [
        'member:id,name,phone,email,status,join_date,coach_id,attendance_code',
        'member.coach:id,name,role',
        'plan:id,name,category,type,sessions_count,is_unlimited_sessions,access_grace_days,duration_days,duration_months',
        'coach:id,name,role',
        'soldBy:id,name',
        'payments',
        'payments.creator:id,name',
        'refunds',
        'freezes',
        'addons.plan:id,name,category,type',
        'addons.coach:id,name,role',
        'addons.payments',
        'addons.payments.creator:id,name',
    ];

    /**
     * @param  array<string, mixed>  $params
     * @return array<string, mixed>
     */
    public function execute(array $params = []): array
    {
        $subscriptionId = isset($params['subscription_id']) && $params['subscription_id'] !== ''
            ? (int) $params['subscription_id']
            : null;

        if ($subscriptionId !== null) {
            return $this->detail($subscriptionId);
        }

        $memberId = isset($params['member_id']) && $params['member_id'] !== ''
            ? (int) $params['member_id']
            : null;

        return $memberId !== null
            ? $this->history($memberId)
            : $this->table($params);
    }

    /**
     * One row per member, sourced from their most recent subscription.
     *
     * @param  array<string, mixed>  $params
     * @return array<string, mixed>
     */
    private function table(array $params): array
    {
        $limit = min(max((int) ($params['limit'] ?? self::DEFAULT_LIMIT), 1), self::MAX_LIMIT);
        $statusFilter = $params['status'] ?? null;

        $query = $this->filtered($params)
            ->whereIn('id', Subscription::query()->selectRaw('MAX(id)')->groupBy('member_id'))
            ->with(self::RELATIONS)
            ->latest('end_date');

        $subscriptions = $query->get();
        $visitStats = $this->visitStats($subscriptions->pluck('id')->all());
        $addonVisitStats = $this->addonVisitStats($subscriptions->pluck('id')->all());
        $historyCounts = $this->historyCounts($subscriptions->pluck('member_id')->all());

        $rows = $subscriptions
            ->map(fn (Subscription $subscription): array => $this->memberRow($subscription, $visitStats, $addonVisitStats, $historyCounts))
            ->when(
                $statusFilter === 'expired',
                fn (Collection $mapped) => $mapped->filter(fn (array $row): bool => $row['latest']['status'] === 'expired'),
            )
            ->values();

        $matched = $rows->count();
        $rows = $rows->take($limit)->values()->all();

        return [
            'totals' => $this->totals($params, count($rows), $matched),
            'members' => $rows,
        ];
    }

    /**
     * The filters both the member rows and the period totals share.
     *
     * Kept in one place so the totals can never end up describing a different
     * set of subscriptions than the table was filtered to.
     *
     * @param  array<string, mixed>  $params
     * @return \Illuminate\Database\Eloquent\Builder<Subscription>
     */
    private function filtered(array $params)
    {
        $statusFilter = $params['status'] ?? null;

        $query = Subscription::query()
            ->when($params['search'] ?? null, fn ($q, $search) => $q->whereHas(
                'member',
                fn ($member) => $member
                    ->where('name', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%")
                    ->orWhere('attendance_code', 'like', "%{$search}%"),
            ))
            ->when($params['plan_id'] ?? null, fn ($q, $planId) => $q->where('plan_id', (int) $planId))
            ->when($params['coach_id'] ?? null, fn ($q, $coachId) => $q->where(
                fn ($scoped) => $scoped
                    ->where('subscriptions.coach_id', (int) $coachId)
                    ->orWhereHas('member', fn ($member) => $member->where('coach_id', (int) $coachId)),
            ));

        // Date range keeps subscriptions whose period overlaps the window, so an
        // older still-running membership is not hidden by it.
        if (! empty($params['from']) || ! empty($params['to'])) {
            $from = Carbon::parse($params['from'] ?? $params['to'])->startOfDay();
            $to = Carbon::parse($params['to'] ?? $params['from'])->endOfDay();

            $query
                ->whereDate('start_date', '<=', $to->toDateString())
                ->whereDate('end_date', '>=', $from->toDateString());
        }

        // Effective status resolves plan grace days in PHP, so only the plain
        // stored statuses can be pushed down to SQL.
        if ($statusFilter && $statusFilter !== 'expired') {
            $query->where('status', $statusFilter);
        }

        return $query;
    }

    /**
     * Every subscription a member has ever had, newest first.
     *
     * @return array<string, mixed>
     */
    private function history(int $memberId): array
    {
        $member = Member::query()
            ->with('coach:id,name,role')
            ->find($memberId);

        if ($member === null) {
            return [
                'member' => null,
                'history' => [],
                'detail' => null,
                'totals' => $this->emptyHistoryTotals(),
            ];
        }

        $subscriptions = Subscription::query()
            ->where('member_id', $memberId)
            ->with(self::RELATIONS)
            ->orderByDesc('start_date')
            ->orderByDesc('id')
            ->get();

        $visitStats = $this->visitStats($subscriptions->pluck('id')->all());
        $addonVisitStats = $this->addonVisitStats($subscriptions->pluck('id')->all());

        $history = $subscriptions
            ->map(fn (Subscription $subscription): array => $this->subscriptionRow($subscription, $visitStats, $addonVisitStats))
            ->values()
            ->all();

        $lifetimePaid = array_reduce(
            $history,
            fn (string $carry, array $row): string => bcadd($carry, $row['package_paid_total'], 2),
            '0.00',
        );
        $lifetimeBalance = array_reduce(
            $history,
            fn (string $carry, array $row): string => bcadd($carry, $row['package_balance'], 2),
            '0.00',
        );
        $lifetimeRefunds = array_reduce(
            $history,
            fn (string $carry, array $row): string => bcadd($carry, $row['refund_total'], 2),
            '0.00',
        );

        return [
            'member' => [
                'id' => $member->id,
                'name' => $member->name,
                'phone' => $member->phone,
                'email' => $member->email,
                'status' => $member->status,
                'join_date' => $member->join_date?->toDateString(),
                'coach_name' => $member->coach?->name,
            ],
            'totals' => [
                'subscriptions_count' => count($history),
                'lifetime_paid' => $lifetimePaid,
                'lifetime_balance' => $lifetimeBalance,
                'lifetime_refunds' => $lifetimeRefunds,
                'lifetime_visits' => array_sum(array_column($history, 'visits_count')),
            ],
            'history' => $history,
            // Preload the newest subscription's log so the drill-down opens
            // populated instead of round-tripping for the default selection.
            'detail' => $subscriptions->first() !== null
                ? $this->detailFor($subscriptions->first(), $visitStats, $addonVisitStats)
                : null,
        ];
    }

    /**
     * Everything recorded against a single subscription: every check-in with
     * its exact times, every payment, freeze and refund.
     *
     * @return array<string, mixed>
     */
    private function detail(int $subscriptionId): array
    {
        $subscription = Subscription::query()
            ->with(self::RELATIONS)
            ->find($subscriptionId);

        if ($subscription === null) {
            return ['detail' => null];
        }

        return [
            'detail' => $this->detailFor(
                $subscription,
                $this->visitStats([$subscription->id]),
                $this->addonVisitStats([$subscription->id]),
            ),
        ];
    }

    /**
     * @param  Collection<int, object>  $visitStats
     * @param  Collection<int, object>  $addonVisitStats
     * @return array<string, mixed>
     */
    private function detailFor(Subscription $subscription, Collection $visitStats, Collection $addonVisitStats): array
    {
        return [
            'subscription' => $this->subscriptionRow($subscription, $visitStats, $addonVisitStats),
            'visits' => $this->visitLog($subscription),
            'payments' => $this->paymentLog($subscription),
            'freezes' => $subscription->freezes
                ->sortByDesc('freeze_start')
                ->map(fn ($freeze): array => [
                    'id' => $freeze->id,
                    'freeze_start' => $freeze->freeze_start?->toDateString(),
                    'freeze_end' => $freeze->freeze_end?->toDateString(),
                    'resumed_on' => $freeze->resumed_on?->toDateString(),
                    'days' => (int) $freeze->days,
                    'remaining_days_at_freeze' => $freeze->remaining_days_at_freeze,
                    'reason' => $freeze->reason,
                ])->values()->all(),
            'refunds' => $subscription->refunds
                ->sortByDesc('refunded_at')
                ->map(fn ($refund): array => [
                    'id' => $refund->id,
                    'amount' => $this->money($refund->amount),
                    'method' => $refund->method,
                    'reason' => $refund->reason,
                    'refunded_at' => $refund->refunded_at?->toIso8601String(),
                ])->values()->all(),
        ];
    }

    /**
     * Every check-in against the subscription, newest first, with the exact
     * in/out stamps and how long the member stayed.
     *
     * @return list<array<string, mixed>>
     */
    private function visitLog(Subscription $subscription): array
    {
        return MemberVisit::query()
            ->where('subscription_id', $subscription->id)
            ->with(['creator:id,name', 'subscriptionAddon.plan:id,name'])
            ->orderByDesc('check_in_at')
            ->get()
            ->map(fn (MemberVisit $visit): array => [
                'id' => $visit->id,
                'check_in_at' => $visit->check_in_at?->toIso8601String(),
                'check_out_at' => $visit->check_out_at?->toIso8601String(),
                'duration_minutes' => $visit->check_in_at && $visit->check_out_at
                    ? (int) $visit->check_in_at->diffInMinutes($visit->check_out_at)
                    : null,
                'is_open' => $visit->check_in_at !== null && $visit->check_out_at === null,
                'status' => $visit->status,
                'counts_as_attendance' => ! in_array($visit->status, self::NON_ATTENDED_VISIT_STATUSES, true),
                'scan_method' => $visit->scan_method,
                'check_in_location_status' => $visit->check_in_location_status,
                'check_out_location_status' => $visit->check_out_location_status,
                'addon_plan_name' => $visit->subscriptionAddon?->plan?->name,
                'alert_reason' => $visit->alert_reason,
                'notes' => $visit->notes,
                'recorded_by' => $visit->creator?->name,
            ])
            ->values()
            ->all();
    }

    /**
     * Subscription and add-on payments merged into one ledger, newest first.
     *
     * @return list<array<string, mixed>>
     */
    private function paymentLog(Subscription $subscription): array
    {
        $rows = $subscription->payments->map(fn (Payment $payment): array => $this->paymentRow(
            $payment,
            $subscription->plan?->name ?? 'Subscription',
            false,
        ));

        foreach ($subscription->addons as $addon) {
            $rows = $rows->concat($addon->payments->map(fn (Payment $payment): array => $this->paymentRow(
                $payment,
                $addon->plan?->name ?? 'Add-on',
                true,
            )));
        }

        return $rows
            ->sortByDesc(fn (array $row): string => $row['paid_at'] ?? $row['created_at'] ?? '')
            ->values()
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    private function paymentRow(Payment $payment, string $target, bool $isAddon): array
    {
        return [
            'id' => $payment->id,
            'amount' => $this->money($payment->amount),
            'method' => $payment->method,
            'status' => $payment->status,
            'paid_at' => $payment->paid_at?->toIso8601String(),
            'due_date' => $payment->due_date?->toDateString(),
            'is_overdue' => ! in_array($payment->status, Payment::COLLECTED_STATUSES, true)
                && $payment->status !== Payment::STATUS_REFUNDED
                && $payment->due_date !== null
                && $payment->due_date->lt(Carbon::today()),
            'target' => $target,
            'is_addon' => $isAddon,
            'recorded_by' => $payment->creator?->name,
            'shift_session_id' => $payment->shift_session_id,
            'created_at' => $payment->created_at?->toIso8601String(),
        ];
    }

    /**
     * @param  Collection<int, object>  $visitStats
     * @param  Collection<int, object>  $addonVisitStats
     * @param  Collection<int, int>  $historyCounts
     * @return array<string, mixed>
     */
    private function memberRow(
        Subscription $subscription,
        Collection $visitStats,
        Collection $addonVisitStats,
        Collection $historyCounts,
    ): array {
        $member = $subscription->member;

        return [
            'member_id' => $subscription->member_id,
            'member_name' => $member?->name ?? '-',
            'member_phone' => $member?->phone,
            'member_status' => $member?->status,
            'join_date' => $member?->join_date?->toDateString(),
            'member_coach_name' => $member?->coach?->name,
            'subscriptions_count' => (int) ($historyCounts->get($subscription->member_id) ?? 1),
            'latest' => $this->subscriptionRow($subscription, $visitStats, $addonVisitStats),
        ];
    }

    /**
     * Full metric set for a single subscription: plan window, attendance, money and staff.
     *
     * @param  Collection<int, object>  $visitStats
     * @param  Collection<int, Collection<int, object>>  $addonVisitStats
     * @return array<string, mixed>
     */
    private function subscriptionRow(Subscription $subscription, Collection $visitStats, Collection $addonVisitStats): array
    {
        $stats = $visitStats->get($subscription->id);
        $status = $this->effectiveStatus($subscription);

        $pricePaid = $this->money($subscription->price_paid);
        $addonPrice = $subscription->addons->reduce(
            fn (string $carry, SubscriptionAddon $addon): string => bcadd($carry, $this->money($addon->price_paid), 2),
            '0.00',
        );
        $packagePrice = bcadd($pricePaid, $addonPrice, 2);

        $paidTotal = $this->settledTotal($subscription->payments);
        $addonPaidTotal = $subscription->addons->reduce(
            fn (string $carry, SubscriptionAddon $addon): string => bcadd($carry, $this->settledTotal($addon->payments), 2),
            '0.00',
        );
        $packagePaidTotal = bcadd($paidTotal, $addonPaidTotal, 2);
        $refundTotal = $subscription->refunds->reduce(
            fn (string $carry, $refund): string => bcadd($carry, $this->money($refund->amount), 2),
            '0.00',
        );

        $packageBalance = in_array($subscription->status, ['stopped', 'expired'], true)
            ? '0.00'
            : $this->positive(bcsub($packagePrice, $packagePaidTotal, 2));

        $payments = $subscription->payments
            ->filter(fn (Payment $payment): bool => in_array($payment->status, Payment::COLLECTED_STATUSES, true));
        $lastPaymentAt = $payments->max('paid_at');

        $sessionsTotal = $subscription->sessions_total;
        $sessionsRemaining = $subscription->sessions_remaining;
        $sessionsUsed = $sessionsTotal !== null && $sessionsRemaining !== null
            ? max(0, (int) $sessionsTotal - (int) $sessionsRemaining)
            : null;

        $visitsCount = (int) ($stats->visits_count ?? 0);
        $freezeDaysUsed = (int) $subscription->freezes->sum('days');

        return [
            'id' => $subscription->id,
            'member_id' => $subscription->member_id,

            // Plan & dates
            'plan_id' => $subscription->plan_id,
            'plan_name' => $subscription->plan?->name ?? '-',
            'plan_category' => $subscription->plan?->category,
            'plan_type' => $subscription->plan?->type,
            'start_date' => $subscription->start_date?->toDateString(),
            'end_date' => $subscription->end_date?->toDateString(),
            'status' => $status,
            'raw_status' => $subscription->status,
            'days_left' => $this->daysLeft($subscription, $status),
            'duration_days' => $this->durationDays($subscription),
            'freeze_days_used' => $freezeDaysUsed,
            'is_frozen' => $subscription->freezes->whereNull('resumed_on')->isNotEmpty(),
            'upgraded_from_subscription_id' => $subscription->upgraded_from_subscription_id,

            // Attendance / sessions
            'sessions_total' => $sessionsTotal,
            'sessions_remaining' => $sessionsRemaining,
            'sessions_used' => $sessionsUsed,
            'is_unlimited_sessions' => $sessionsTotal === null,
            'visits_count' => $visitsCount,
            'visit_days_count' => (int) ($stats->visit_days ?? 0),
            'first_visit_at' => $this->isoDate($stats->first_visit_at ?? null),
            'last_visit_at' => $this->isoDate($stats->last_visit_at ?? null),
            'attendance_rate' => $this->attendanceRate($sessionsTotal, $sessionsUsed),
            'visits_per_week' => $this->visitsPerWeek($subscription, $visitsCount),

            // Payments
            'price_paid' => $pricePaid,
            'discount' => $this->money($subscription->discount),
            'addons_price_total' => $addonPrice,
            'package_price' => $packagePrice,
            'paid_total' => $paidTotal,
            'package_paid_total' => $packagePaidTotal,
            'package_balance' => $packageBalance,
            'refund_total' => $refundTotal,
            'payments_count' => $payments->count(),
            'last_payment_at' => $this->isoDate($lastPaymentAt),
            'billing_status' => $this->billingStatus($subscription, $packageBalance, $refundTotal, $packagePaidTotal),

            // Staff & extras
            'coach_name' => $subscription->coach?->name ?? $subscription->member?->coach?->name,
            'sold_by' => $subscription->soldBy?->name,
            'addons_count' => $subscription->addons->count(),
            'addons' => $subscription->addons->map(fn (SubscriptionAddon $addon): array => [
                'id' => $addon->id,
                'plan_name' => $addon->plan?->name ?? '-',
                'plan_category' => $addon->plan?->category,
                'coach_name' => $addon->coach?->name,
                'status' => $addon->status,
                'start_date' => $addon->start_date?->toDateString(),
                'end_date' => $addon->end_date?->toDateString(),
                'price_paid' => $this->money($addon->price_paid),
                'paid_total' => $this->settledTotal($addon->payments),
                'sessions_total' => $addon->sessions_total,
                'sessions_remaining' => $addon->sessions_remaining,
                'visits_count' => (int) ($addonVisitStats->get($addon->id)->visits_count ?? 0),
            ])->values()->all(),

            'created_at' => $subscription->created_at?->toIso8601String(),
        ];
    }

    /**
     * @param  list<int>  $subscriptionIds
     * @return Collection<int, object>
     */
    private function visitStats(array $subscriptionIds): Collection
    {
        if ($subscriptionIds === []) {
            return collect();
        }

        return MemberVisit::query()
            ->whereIn('subscription_id', $subscriptionIds)
            ->whereNotIn('status', self::NON_ATTENDED_VISIT_STATUSES)
            ->selectRaw('subscription_id, COUNT(*) as visits_count, COUNT(DISTINCT DATE(check_in_at)) as visit_days, MIN(check_in_at) as first_visit_at, MAX(check_in_at) as last_visit_at')
            ->groupBy('subscription_id')
            ->get()
            ->keyBy('subscription_id');
    }

    /**
     * Total subscriptions per member, so the row can advertise how much
     * history sits behind the latest one without an N+1 count.
     *
     * @param  list<int>  $memberIds
     * @return Collection<int, int>
     */
    private function historyCounts(array $memberIds): Collection
    {
        if ($memberIds === []) {
            return collect();
        }

        return Subscription::query()
            ->whereIn('member_id', $memberIds)
            ->selectRaw('member_id, COUNT(*) as total')
            ->groupBy('member_id')
            ->pluck('total', 'member_id');
    }

    /**
     * @param  list<int>  $subscriptionIds
     * @return Collection<int, object>
     */
    private function addonVisitStats(array $subscriptionIds): Collection
    {
        if ($subscriptionIds === []) {
            return collect();
        }

        return MemberVisit::query()
            ->whereIn('subscription_id', $subscriptionIds)
            ->whereNotNull('subscription_addon_id')
            ->whereNotIn('status', self::NON_ATTENDED_VISIT_STATUSES)
            ->selectRaw('subscription_addon_id, COUNT(*) as visits_count')
            ->groupBy('subscription_addon_id')
            ->get()
            ->keyBy('subscription_addon_id');
    }

    /**
     * Money and status totals for EVERY subscription matching the filters, not
     * just the one row shown per member.
     *
     * The table deliberately shows a member once, from their newest membership.
     * Totalling those rows meant a member who renewed three times in the period
     * only contributed their last renewal, so collections and refunds read far
     * below what actually moved. The totals therefore run over the full filtered
     * set while the table keeps its one-row-per-member shape.
     *
     * @param  array<string, mixed>  $params
     * @return array<string, mixed>
     */
    private function totals(array $params, int $shown, int $matched): array
    {
        $statusFilter = $params['status'] ?? null;

        $subscriptions = $this->filtered($params)->with(self::RELATIONS)->get();
        $visitStats = $this->visitStats($subscriptions->pluck('id')->all());
        $addonVisitStats = $this->addonVisitStats($subscriptions->pluck('id')->all());

        $all = $subscriptions
            ->map(fn (Subscription $subscription): array => $this->subscriptionRow($subscription, $visitStats, $addonVisitStats))
            ->when(
                $statusFilter === 'expired',
                fn (Collection $mapped) => $mapped->filter(fn (array $row): bool => $row['status'] === 'expired'),
            )
            ->values()
            ->all();

        $collected = array_reduce(
            $all,
            fn (string $carry, array $row): string => bcadd($carry, $row['package_paid_total'], 2),
            '0.00',
        );
        $outstanding = array_reduce(
            $all,
            fn (string $carry, array $row): string => bcadd($carry, $row['package_balance'], 2),
            '0.00',
        );
        $refunded = array_reduce(
            $all,
            fn (string $carry, array $row): string => bcadd($carry, $row['refund_total'], 2),
            '0.00',
        );

        $rated = array_values(array_filter(
            array_column($all, 'attendance_rate'),
            fn (?float $rate): bool => $rate !== null,
        ));

        return [
            'members_count' => $shown,
            'matched_count' => $matched,
            'truncated' => $matched > $shown,
            'subscriptions_count' => count($all),
            'active_count' => count(array_filter($all, fn (array $row): bool => $row['status'] === 'active')),
            // Sold in advance and not started yet. Counted apart from active so
            // the two never silently add up to a number nobody can reconcile.
            'scheduled_count' => count(array_filter($all, fn (array $row): bool => $row['status'] === 'scheduled')),
            'expired_count' => count(array_filter($all, fn (array $row): bool => $row['status'] === 'expired')),
            'frozen_count' => count(array_filter($all, fn (array $row): bool => $row['status'] === 'frozen')),
            'stopped_count' => count(array_filter($all, fn (array $row): bool => $row['status'] === 'stopped')),
            'total_collected' => $collected,
            'total_outstanding' => $outstanding,
            'total_refunded' => $refunded,
            'total_visits' => array_sum(array_column($all, 'visits_count')),
            'avg_attendance_rate' => $rated === [] ? null : round(array_sum($rated) / count($rated), 1),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function emptyHistoryTotals(): array
    {
        return [
            'subscriptions_count' => 0,
            'lifetime_paid' => '0.00',
            'lifetime_balance' => '0.00',
            'lifetime_refunds' => '0.00',
            'lifetime_visits' => 0,
        ];
    }

    /**
     * Mirrors SubscriptionResource: an active membership past its plan grace
     * window reads as expired even before the nightly job flips the column.
     */
    private function effectiveStatus(Subscription $subscription): string
    {
        if ($subscription->status !== 'active') {
            return $subscription->status;
        }

        // Sold in advance: not running yet, and check-in refuses it until the
        // start date arrives.
        if ($subscription->start_date && $subscription->start_date->gt(Carbon::today())) {
            return 'scheduled';
        }

        if (! $subscription->end_date) {
            return $subscription->status;
        }

        $graceDays = (int) ($subscription->plan?->access_grace_days ?? 0);

        return $subscription->end_date->copy()->addDays($graceDays)->lt(Carbon::today())
            ? 'expired'
            : $subscription->status;
    }

    private function daysLeft(Subscription $subscription, string $status): ?int
    {
        if (in_array($status, ['stopped', 'expired'], true) || ! $subscription->end_date) {
            return null;
        }

        return (int) Carbon::today()->diffInDays($subscription->end_date, false);
    }

    private function durationDays(Subscription $subscription): ?int
    {
        if (! $subscription->start_date || ! $subscription->end_date) {
            return null;
        }

        return (int) $subscription->start_date->diffInDays($subscription->end_date) + 1;
    }

    private function attendanceRate(?int $sessionsTotal, ?int $sessionsUsed): ?float
    {
        if ($sessionsTotal === null || $sessionsUsed === null || $sessionsTotal <= 0) {
            return null;
        }

        return round(min(100, $sessionsUsed / $sessionsTotal * 100), 1);
    }

    private function visitsPerWeek(Subscription $subscription, int $visitsCount): ?float
    {
        if ($visitsCount === 0 || ! $subscription->start_date) {
            return null;
        }

        // Measure against elapsed time only, so a fresh membership is not
        // penalised for days it has not reached yet.
        $end = $subscription->end_date && $subscription->end_date->lt(Carbon::today())
            ? $subscription->end_date
            : Carbon::today();
        $days = max(1, (int) $subscription->start_date->diffInDays($end) + 1);

        return round($visitsCount / $days * 7, 1);
    }

    /**
     * @param  EloquentCollection<int, Payment>  $payments
     */
    private function settledTotal(EloquentCollection $payments): string
    {
        return $payments
            ->filter(fn (Payment $payment): bool => in_array($payment->status, Payment::SETTLEMENT_STATUSES, true))
            ->reduce(fn (string $carry, Payment $payment): string => bcadd($carry, $this->money($payment->amount), 2), '0.00');
    }

    private function billingStatus(Subscription $subscription, string $balance, string $refundTotal, string $paidTotal): string
    {
        if (bccomp($refundTotal, '0.00', 2) === 1) {
            return bccomp($paidTotal, '0.00', 2) <= 0 ? 'refunded' : 'partial_refund';
        }

        if (in_array($subscription->status, ['stopped', 'expired'], true)) {
            return 'stopped';
        }

        if (bccomp($balance, '0.00', 2) <= 0) {
            return 'paid';
        }

        $hasOverdue = $subscription->payments->contains(
            fn (Payment $payment): bool => ! in_array($payment->status, Payment::COLLECTED_STATUSES, true)
                && $payment->status !== Payment::STATUS_REFUNDED
                && $payment->due_date !== null
                && $payment->due_date->lt(Carbon::today()),
        );

        return $hasOverdue ? 'overdue' : 'pending';
    }

    private function money(mixed $value): string
    {
        return number_format((float) ($value ?? 0), 2, '.', '');
    }

    private function positive(string $value): string
    {
        return bccomp($value, '0.00', 2) === 1 ? $value : '0.00';
    }

    private function isoDate(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        return $value instanceof Carbon
            ? $value->toIso8601String()
            : Carbon::parse((string) $value)->toIso8601String();
    }
}
