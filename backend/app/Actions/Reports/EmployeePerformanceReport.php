<?php

namespace App\Actions\Reports;

use App\Models\Commission;
use App\Models\Sale;
use App\Models\Subscription;
use App\Models\SubscriptionAddon;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Support\Facades\DB;

class EmployeePerformanceReport
{
    /**
     * Generate employee performance report(s).
     *
     * @param  array{from?: string|null, to?: string|null, employee_id?: int|null}  $params
     */
    public function execute(array $params): mixed
    {
        $todayOnly = ($params['_today_only'] ?? false) === true;
        $from = $params['from'] ?? Carbon::now()->startOfMonth()->toDateString();
        $to = $params['to'] ?? Carbon::now()->endOfMonth()->toDateString();

        $startDate = Carbon::parse($from)->startOfDay()->toDateTimeString();
        $endDate = Carbon::parse($to)->endOfDay()->toDateTimeString();
        $periodStart = Carbon::parse($from)->startOfDay();
        $periodEnd = Carbon::parse($to)->endOfDay();
        $periodDays = max(1, (int) $periodStart->diffInDays($periodEnd) + 1);
        $previousEnd = $periodStart->copy()->subSecond();
        $previousStart = $previousEnd->copy()->subDays($periodDays - 1)->startOfDay();

        $query = DB::table('employees')
            ->leftJoin('users', 'employees.user_id', '=', 'users.id')
            ->leftJoinSub(
                DB::table('sales')
                    ->select('sold_by_user_id', DB::raw('COUNT(*) as sales_count'), DB::raw('SUM(total) as sales_volume'))
                    ->whereBetween('created_at', [$startDate, $endDate])
                    ->groupBy('sold_by_user_id'),
                's',
                'employees.user_id',
                '=',
                's.sold_by_user_id'
            )
            ->leftJoinSub(
                DB::table('subscriptions')
                    ->select('sold_by_user_id', DB::raw('COUNT(*) as subscriptions_count'))
                    ->whereBetween('created_at', [$startDate, $endDate])
                    ->groupBy('sold_by_user_id'),
                'sub',
                'employees.user_id',
                '=',
                'sub.sold_by_user_id'
            )
            ->leftJoinSub(
                DB::table('subscription_addons')
                    ->select('sold_by_user_id', DB::raw('COUNT(*) as coached_services_count'), DB::raw('SUM(price_paid) as coached_services_revenue'))
                    ->whereBetween('created_at', [$startDate, $endDate])
                    ->groupBy('sold_by_user_id'),
                'sa',
                'employees.user_id',
                '=',
                'sa.sold_by_user_id'
            )
            ->leftJoinSub(
                DB::table('commissions')
                    ->select(
                        'employee_id',
                        DB::raw('SUM(amount) as commissions_earned'),
                        DB::raw('SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as commissions_positive'),
                        DB::raw('ABS(SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END)) as commissions_reversed'),
                    )
                    ->whereBetween('created_at', [$startDate, $endDate])
                    ->groupBy('employee_id'),
                'c',
                'employees.id',
                '=',
                'c.employee_id'
            )
            ->leftJoinSub(
                DB::table('attendance')
                    ->select('employee_id', DB::raw('COUNT(*) as attendance_count'))
                    ->whereBetween('date', [$from, $to])
                    ->whereIn('status', ['present', 'late'])
                    ->groupBy('employee_id'),
                'a',
                'employees.id',
                '=',
                'a.employee_id'
            )
            ->leftJoinSub(
                DB::table('member_bookings')
                    ->select('coach_id', DB::raw('COUNT(*) as bookings_count'))
                    ->whereBetween('starts_at', [$startDate, $endDate])
                    ->where('status', '!=', 'cancelled')
                    ->groupBy('coach_id'),
                'b',
                'employees.id',
                '=',
                'b.coach_id'
            )
            ->leftJoinSub(
                DB::table('sales')
                    ->select('sold_by_user_id', DB::raw('COUNT(*) as previous_sales_count'), DB::raw('SUM(total) as previous_sales_volume'))
                    ->whereBetween('created_at', [$previousStart->toDateTimeString(), $previousEnd->toDateTimeString()])
                    ->groupBy('sold_by_user_id'),
                'ps',
                'employees.user_id',
                '=',
                'ps.sold_by_user_id'
            )
            ->leftJoinSub(
                DB::table('subscriptions')
                    ->select('sold_by_user_id', DB::raw('COUNT(*) as previous_subscriptions_count'))
                    ->whereBetween('created_at', [$previousStart->toDateTimeString(), $previousEnd->toDateTimeString()])
                    ->groupBy('sold_by_user_id'),
                'psub',
                'employees.user_id',
                '=',
                'psub.sold_by_user_id'
            )
            ->leftJoinSub(
                DB::table('subscription_addons')
                    ->select('sold_by_user_id', DB::raw('COUNT(*) as previous_coached_services_count'), DB::raw('SUM(price_paid) as previous_coached_services_revenue'))
                    ->whereBetween('created_at', [$previousStart->toDateTimeString(), $previousEnd->toDateTimeString()])
                    ->groupBy('sold_by_user_id'),
                'psa',
                'employees.user_id',
                '=',
                'psa.sold_by_user_id'
            )
            ->leftJoinSub(
                DB::table('commissions')
                    ->select('employee_id', DB::raw('SUM(amount) as previous_commissions_earned'))
                    ->whereBetween('created_at', [$previousStart->toDateTimeString(), $previousEnd->toDateTimeString()])
                    ->groupBy('employee_id'),
                'pc',
                'employees.id',
                '=',
                'pc.employee_id'
            )
            ->select([
                'employees.id as employee_id',
                'employees.user_id',
                DB::raw('COALESCE(users.name, employees.name) as name'),
                'employees.role',
                DB::raw('COALESCE(s.sales_count, 0) as sales_count'),
                DB::raw('COALESCE(s.sales_volume, 0.00) as sales_volume'),
                DB::raw('COALESCE(sub.subscriptions_count, 0) as subscriptions_count'),
                DB::raw('COALESCE(sa.coached_services_count, 0) as coached_services_count'),
                DB::raw('COALESCE(sa.coached_services_revenue, 0.00) as coached_services_revenue'),
                DB::raw('COALESCE(c.commissions_earned, 0.00) as commissions_earned'),
                DB::raw('COALESCE(c.commissions_positive, 0.00) as commissions_positive'),
                DB::raw('COALESCE(c.commissions_reversed, 0.00) as commissions_reversed'),
                DB::raw('COALESCE(a.attendance_count, 0) as attendance_count'),
                DB::raw('COALESCE(b.bookings_count, 0) as bookings_count'),
                DB::raw('COALESCE(ps.previous_sales_count, 0) as previous_sales_count'),
                DB::raw('COALESCE(ps.previous_sales_volume, 0.00) as previous_sales_volume'),
                DB::raw('COALESCE(psub.previous_subscriptions_count, 0) as previous_subscriptions_count'),
                DB::raw('COALESCE(psa.previous_coached_services_count, 0) as previous_coached_services_count'),
                DB::raw('COALESCE(psa.previous_coached_services_revenue, 0.00) as previous_coached_services_revenue'),
                DB::raw('COALESCE(pc.previous_commissions_earned, 0.00) as previous_commissions_earned'),
            ]);

        if (isset($params['employee_id'])) {
            $row = $query->where('employees.id', $params['employee_id'])->first();
            if ($row) {
                $this->formatRow($row, $todayOnly);
                $row->subscriptions = $this->subscriptionDetails((int) $row->user_id, $startDate, $endDate);
                $row->commissions = $this->commissionDetails((int) $row->employee_id, $startDate, $endDate);
            }

            return $row;
        }

        return $query->orderBy('employee_id', 'asc')
            ->cursorPaginate(15)->through(function ($item) use ($todayOnly) {
                $this->formatRow($item, $todayOnly);

                return $item;
            });
    }

    private function formatRow(object $row, bool $todayOnly = false): void
    {
        $row->commissions_earned = number_format((float) $row->commissions_earned, 2, '.', '');
        $row->commissions_positive = number_format((float) $row->commissions_positive, 2, '.', '');
        $row->commissions_reversed = number_format((float) $row->commissions_reversed, 2, '.', '');
        $row->sales_volume = number_format((float) $row->sales_volume, 2, '.', '');
        $row->coached_services_revenue = number_format((float) $row->coached_services_revenue, 2, '.', '');
        $row->previous_sales_volume = number_format((float) $row->previous_sales_volume, 2, '.', '');
        $row->previous_coached_services_revenue = number_format((float) $row->previous_coached_services_revenue, 2, '.', '');
        $row->previous_commissions_earned = number_format((float) $row->previous_commissions_earned, 2, '.', '');
        $row->sales_count = (int) $row->sales_count;
        $row->subscriptions_count = (int) $row->subscriptions_count;
        $row->coached_services_count = (int) $row->coached_services_count;
        $row->attendance_count = (int) $row->attendance_count;
        $row->bookings_count = (int) $row->bookings_count;
        $row->previous_sales_count = (int) $row->previous_sales_count;
        $row->previous_subscriptions_count = (int) $row->previous_subscriptions_count;
        $row->previous_coached_services_count = (int) $row->previous_coached_services_count;

        if ($todayOnly) {
            $row->previous_sales_count = 0;
            $row->previous_sales_volume = '0.00';
            $row->previous_subscriptions_count = 0;
            $row->previous_coached_services_count = 0;
            $row->previous_coached_services_revenue = '0.00';
            $row->previous_commissions_earned = '0.00';
        }

        $row->comparison = [
            'sales_count_delta' => $todayOnly ? null : $row->sales_count - $row->previous_sales_count,
            'subscriptions_count_delta' => $todayOnly ? null : $row->subscriptions_count - $row->previous_subscriptions_count,
            'coached_services_count_delta' => $todayOnly ? null : $row->coached_services_count - $row->previous_coached_services_count,
            'commissions_delta' => $todayOnly ? null : number_format((float) $row->commissions_earned - (float) $row->previous_commissions_earned, 2, '.', ''),
            'sales_volume_delta' => $todayOnly ? null : number_format((float) $row->sales_volume - (float) $row->previous_sales_volume, 2, '.', ''),
            'coached_services_revenue_delta' => $todayOnly ? null : number_format((float) $row->coached_services_revenue - (float) $row->previous_coached_services_revenue, 2, '.', ''),
        ];
    }

    /**
     * @return list<array<string, int|string|null>>
     */
    private function subscriptionDetails(int $userId, string $startDate, string $endDate): array
    {
        if ($userId < 1) {
            return [];
        }

        $subscriptions = Subscription::query()
            ->with([
                'member:id,name,phone,email,attendance_code',
                'plan:id,name',
                'freezes:id,subscription_id,freeze_start,freeze_end,resumed_on',
                'refunds:id,subscription_id,amount,refunded_at',
            ])
            ->where('sold_by_user_id', $userId)
            ->whereBetween('created_at', [$startDate, $endDate])
            ->latest()
            ->get([
                'id',
                'member_id',
                'plan_id',
                'upgraded_from_subscription_id',
                'start_date',
                'end_date',
                'status',
                'price_paid',
                'created_at',
            ])
            ->map(function (Subscription $subscription): array {
                $isFrozen = $subscription->freezes->contains(fn ($freeze): bool => ! $freeze->resumed_on
                    && $freeze->freeze_start?->isPast()
                    && $freeze->freeze_end?->isFuture()
                );
                $refundTotal = (float) $subscription->refunds->sum('amount');

                return [
                    'id' => $subscription->id,
                    'member_id' => $subscription->member_id,
                    'member_name' => $subscription->member?->name,
                    'member_phone' => $subscription->member?->phone,
                    'member_email' => $subscription->member?->email,
                    'member_code' => $subscription->member?->attendance_code,
                    'plan_name' => $subscription->plan?->name,
                    'type' => $subscription->upgraded_from_subscription_id ? 'renewal' : 'new_subscription',
                    'price_paid' => number_format((float) $subscription->price_paid, 2, '.', ''),
                    'status' => $subscription->status,
                    'lifecycle_status' => $refundTotal > 0 ? 'refunded' : ($isFrozen ? 'frozen' : $subscription->status),
                    'refund_total' => number_format($refundTotal, 2, '.', ''),
                    'start_date' => $subscription->start_date?->toDateString(),
                    'end_date' => $subscription->end_date?->toDateString(),
                    'created_at' => $subscription->created_at?->toDateTimeString(),
                ];
            })
            ->all();

        $addons = SubscriptionAddon::query()
            ->with([
                'member:id,name,phone,email,attendance_code',
                'plan:id,name',
            ])
            ->where('sold_by_user_id', $userId)
            ->whereBetween('created_at', [$startDate, $endDate])
            ->latest()
            ->get(['id', 'member_id', 'plan_id', 'start_date', 'end_date', 'status', 'price_paid', 'created_at'])
            ->map(fn (SubscriptionAddon $addon): array => [
                'id' => 'addon-'.$addon->id,
                'member_id' => $addon->member_id,
                'member_name' => $addon->member?->name,
                'member_phone' => $addon->member?->phone,
                'member_email' => $addon->member?->email,
                'member_code' => $addon->member?->attendance_code,
                'plan_name' => $addon->plan?->name,
                'type' => 'add_on',
                'price_paid' => number_format((float) $addon->price_paid, 2, '.', ''),
                'status' => $addon->status,
                'start_date' => $addon->start_date?->toDateString(),
                'end_date' => $addon->end_date?->toDateString(),
                'created_at' => $addon->created_at?->toDateTimeString(),
            ])
            ->all();

        return collect([...$subscriptions, ...$addons])
            ->sortByDesc('created_at')
            ->values()
            ->all();
    }

    /**
     * @return list<array<string, int|string|null>>
     */
    private function commissionDetails(int $employeeId, string $startDate, string $endDate): array
    {
        return Commission::query()
            ->with([
                'source' => function (MorphTo $morphTo): void {
                    $morphTo->constrain([
                        Subscription::class => fn ($query) => $query->with([
                            'member:id,name,attendance_code',
                            'plan:id,name',
                        ]),
                        SubscriptionAddon::class => fn ($query) => $query->with([
                            'member:id,name,attendance_code',
                            'plan:id,name',
                        ]),
                        Sale::class => fn ($query) => $query->with([
                            'member:id,name,attendance_code',
                        ]),
                    ]);
                },
            ])
            ->where('employee_id', $employeeId)
            ->whereBetween('created_at', [$startDate, $endDate])
            ->orderByDesc('created_at')
            ->get()
            ->map(function (Commission $commission): array {
                $source = $commission->source;

                return [
                    'id' => $commission->id,
                    'occurred_at' => $commission->created_at?->toDateTimeString(),
                    'source_kind' => match ($commission->source_type) {
                        SubscriptionAddon::class => 'extra_service',
                        Sale::class => 'pos_sale',
                        default => 'membership',
                    },
                    'source_id' => $commission->source_id,
                    'commission_type' => $commission->commission_type,
                    'calculation_type' => $commission->calculation_type,
                    'rate' => number_format((float) $commission->rate, 4, '.', ''),
                    'rule_value' => number_format((float) $commission->rule_value, 4, '.', ''),
                    'amount' => number_format((float) $commission->amount, 2, '.', ''),
                    'status' => $commission->status,
                    'member_name' => $source?->member?->name,
                    'member_code' => $source?->member?->attendance_code,
                    'plan_name' => $source instanceof Sale ? null : $source?->plan?->name,
                ];
            })
            ->all();
    }
}
