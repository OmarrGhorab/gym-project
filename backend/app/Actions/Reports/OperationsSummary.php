<?php

namespace App\Actions\Reports;

use App\Models\AttendanceViolation;
use App\Models\MemberVisit;
use App\Models\OperationsCalendarEvent;
use App\Models\Payment;
use App\Models\Payroll;
use App\Models\Product;
use App\Models\Sale;
use App\Models\Subscription;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Spatie\Activitylog\Models\Activity;

final class OperationsSummary
{
    /**
     * @return array<string, mixed>
     */
    public function execute(): array
    {
        $now = CarbonImmutable::now();
        $today = $now->toDateString();
        $weekStart = $now->startOfWeek();
        $weekEnd = $now->endOfWeek();

        $pendingViolations = AttendanceViolation::query()
            ->with('employee:id,name,role')
            ->where('status', 'pending')
            ->orderBy('violation_date')
            ->get();

        $blockedVisits = MemberVisit::query()
            ->with('member:id,name')
            ->whereDate('check_in_at', $today)
            ->whereIn('status', ['blocked', 'flagged'])
            ->latest('check_in_at')
            ->get();

        $expiringSubscriptions = Subscription::query()
            ->with(['member:id,name', 'plan:id,name'])
            ->where('status', 'active')
            ->whereBetween('end_date', [$today, $now->addDays(7)->toDateString()])
            ->orderBy('end_date')
            ->limit(8)
            ->get();

        $lowStockProducts = Product::query()
            ->lowStock()
            ->active()
            ->orderBy('stock_quantity')
            ->limit(8)
            ->get();

        $pendingPayroll = Payroll::query()
            ->with('employee:id,name,role')
            ->where('status', 'pending')
            ->latest()
            ->get();

        $dues = $this->outstandingDues();
        $tasks = $this->tasks($pendingViolations, $blockedVisits, $expiringSubscriptions, $lowStockProducts, $pendingPayroll, $dues['rows']);
        $completedSignals = $this->completedSignals($weekStart, $weekEnd);
        $totalSignals = max($tasks->count() + $completedSignals, 1);
        $weeklyProgress = (int) round(($completedSignals / $totalSignals) * 100);

        return [
            'generated_at' => $now->toIso8601String(),
            'summary' => [
                'today_action_count' => $tasks->whereIn('priority', ['high', 'medium'])->count(),
                'pending_review_count' => $pendingViolations->count() + $blockedVisits->count(),
                'week_progress' => $weeklyProgress,
                'focus_title' => $this->focusTitle($tasks),
                'focus_description' => $this->focusDescription($tasks),
                'focus_href' => $this->focusHref($tasks),
            ],
            'tasks' => $tasks->take(8)->values()->all(),
            'workflows' => $this->workflows($pendingViolations, $pendingPayroll, $expiringSubscriptions, $dues, $lowStockProducts),
            'quick_actions' => [
                ['label' => 'Attendance Review', 'href' => '/dashboard/attendance'],
                ['label' => 'Membership Follow-up', 'href' => '/dashboard/members'],
                ['label' => 'Finance Collections', 'href' => '/dashboard/finance'],
                ['label' => 'Payroll', 'href' => '/dashboard/payroll'],
                ['label' => 'Products', 'href' => '/dashboard/logistics'],
            ],
            'calendar_events' => $this->calendarEvents($expiringSubscriptions, $pendingPayroll),
            'activity' => $this->activity(),
            'week' => [
                'label' => 'This Week',
                'progress' => $weeklyProgress,
                'completed' => $completedSignals,
                'total' => $totalSignals,
                'member_visits' => MemberVisit::query()->whereBetween('check_in_at', [$weekStart, $weekEnd])->count(),
                'subscriptions_renewed' => Subscription::query()->whereBetween('created_at', [$weekStart, $weekEnd])->count(),
                'sales' => Sale::query()->completed()->whereBetween('created_at', [$weekStart, $weekEnd])->count(),
                'payroll_paid' => Payroll::query()->where('status', 'paid')->whereBetween('paid_at', [$weekStart, $weekEnd])->count(),
            ],
        ];
    }

    /**
     * @param  Collection<int, AttendanceViolation>  $pendingViolations
     * @param  Collection<int, MemberVisit>  $blockedVisits
     * @param  Collection<int, Subscription>  $expiringSubscriptions
     * @param  Collection<int, Product>  $lowStockProducts
     * @param  Collection<int, Payroll>  $pendingPayroll
     * @param  Collection<int, array<string, mixed>>  $dues
     * @return Collection<int, array<string, mixed>>
     */
    private function tasks(
        Collection $pendingViolations,
        Collection $blockedVisits,
        Collection $expiringSubscriptions,
        Collection $lowStockProducts,
        Collection $pendingPayroll,
        Collection $dues,
    ): Collection {
        return collect()
            ->merge($pendingViolations->map(fn (AttendanceViolation $violation): array => [
                'id' => 'violation-'.$violation->id,
                'title' => 'Review '.$violation->employee?->name.' attendance warning',
                'tag' => 'Attendance',
                'priority' => 'high',
                'due_label' => $violation->violation_date?->format('M d') ?? 'Today',
                'href' => '/dashboard/attendance',
            ]))
            ->merge($blockedVisits->map(fn (MemberVisit $visit): array => [
                'id' => 'visit-'.$visit->id,
                'title' => 'Check '.$visit->member?->name.' '.$visit->status.' visit',
                'tag' => 'Member Visit',
                'priority' => $visit->status === 'blocked' ? 'high' : 'medium',
                'due_label' => $visit->check_in_at?->format('h:i A') ?? 'Today',
                'href' => '/dashboard/attendance',
            ]))
            ->merge($dues->map(fn (array $due): array => [
                'id' => 'due-'.$due['id'],
                'title' => 'Collect '.$due['amount'].' from '.$due['title'],
                'tag' => 'Dues',
                'priority' => 'medium',
                'due_label' => $due['description'],
                'href' => '/dashboard/finance',
            ]))
            ->merge($expiringSubscriptions->map(fn (Subscription $subscription): array => [
                'id' => 'subscription-'.$subscription->id,
                'title' => 'Follow up renewal for '.$subscription->member?->name,
                'tag' => 'Renewal',
                'priority' => 'medium',
                'due_label' => 'Ends '.$subscription->end_date?->format('M d'),
                'href' => '/dashboard/members',
            ]))
            ->merge($pendingPayroll->take(5)->map(fn (Payroll $payroll): array => [
                'id' => 'payroll-'.$payroll->id,
                'title' => 'Pay '.$payroll->employee?->name.' salary receipt',
                'tag' => 'Payroll',
                'priority' => 'medium',
                'due_label' => $payroll->month,
                'href' => '/dashboard/payroll',
            ]))
            ->merge($lowStockProducts->map(fn (Product $product): array => [
                'id' => 'product-'.$product->id,
                'title' => 'Restock '.$product->name,
                'tag' => 'Inventory',
                'priority' => 'low',
                'due_label' => $product->stock_quantity.' left',
                'href' => '/dashboard/logistics',
            ]))
            ->sortBy(fn (array $task): int => ['high' => 0, 'medium' => 1, 'low' => 2][$task['priority']] ?? 3)
            ->values();
    }

    /**
     * @param  Collection<int, AttendanceViolation>  $pendingViolations
     * @param  Collection<int, Payroll>  $pendingPayroll
     * @param  Collection<int, Subscription>  $expiringSubscriptions
     * @param  array{total: float, count: int, rows: Collection<int, array<string, mixed>>}  $dues
     * @param  Collection<int, Product>  $lowStockProducts
     * @return array<int, array<string, mixed>>
     */
    private function workflows(
        Collection $pendingViolations,
        Collection $pendingPayroll,
        Collection $expiringSubscriptions,
        array $dues,
        Collection $lowStockProducts,
    ): array {
        return [
            [
                'title' => 'Attendance Review',
                'status' => $pendingViolations->isEmpty() ? 'Clear' : 'Needs Review',
                'description' => $pendingViolations->count().' warnings waiting for admin decision.',
                'progress' => $pendingViolations->isEmpty() ? 100 : max(10, 100 - ($pendingViolations->count() * 15)),
                'footer' => 'Staff warnings and exceptions',
                'href' => '/dashboard/attendance',
            ],
            [
                'title' => 'Payroll Run',
                'status' => $pendingPayroll->isEmpty() ? 'Paid' : 'Pending',
                'description' => $pendingPayroll->count().' salary receipts pending payment.',
                'progress' => $pendingPayroll->isEmpty() ? 100 : max(20, 100 - ($pendingPayroll->count() * 10)),
                'footer' => 'Attendance deductions included',
                'href' => '/dashboard/payroll',
            ],
            [
                'title' => 'Membership Follow-up',
                'status' => $expiringSubscriptions->isEmpty() && $dues['count'] === 0 ? 'Healthy' : 'Active',
                'description' => $expiringSubscriptions->count().' renewals soon · '.$dues['count'].' dues.',
                'progress' => max(5, 100 - (($expiringSubscriptions->count() + $dues['count']) * 8)),
                'footer' => 'Renewals and collections',
                'href' => '/dashboard/members',
            ],
            [
                'title' => 'Inventory Watch',
                'status' => $lowStockProducts->isEmpty() ? 'Stocked' : 'Low Stock',
                'description' => $lowStockProducts->count().' products need restock attention.',
                'progress' => $lowStockProducts->isEmpty() ? 100 : max(15, 100 - ($lowStockProducts->count() * 12)),
                'footer' => 'POS product availability',
                'href' => '/dashboard/logistics',
            ],
        ];
    }

    /**
     * @param  Collection<int, Subscription>  $expiringSubscriptions
     * @param  Collection<int, Payroll>  $pendingPayroll
     * @return array<int, array<string, mixed>>
     */
    private function calendarEvents(Collection $expiringSubscriptions, Collection $pendingPayroll): array
    {
        $renewals = collect($expiringSubscriptions->map(fn (Subscription $subscription): array => [
            'date' => $subscription->end_date?->toDateString(),
            'title' => $subscription->member?->name.' renewal',
            'type' => 'renewal',
        ])->values());

        $payroll = collect($pendingPayroll->take(5)->map(fn (Payroll $row): array => [
            'date' => CarbonImmutable::now()->endOfMonth()->toDateString(),
            'title' => $row->employee?->name.' payroll',
            'type' => 'payroll',
        ])->values());

        $custom = OperationsCalendarEvent::query()
            ->whereBetween('date', [CarbonImmutable::now()->startOfMonth()->toDateString(), CarbonImmutable::now()->addMonthsNoOverflow(2)->endOfMonth()->toDateString()])
            ->orderBy('date')
            ->get()
            ->map(fn (OperationsCalendarEvent $event): array => [
                'id' => $event->id,
                'date' => $event->date?->toDateString(),
                'title' => $event->title,
                'type' => $event->type,
                'notes' => $event->notes,
                'editable' => true,
            ]);

        return $renewals
            ->merge($payroll)
            ->merge($custom)
            ->filter(fn (array $event): bool => filled($event['date']))
            ->values()
            ->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function activity(): array
    {
        return Activity::query()
            ->latest()
            ->limit(5)
            ->get()
            ->map(fn (Activity $activity): array => [
                'id' => $activity->id,
                'title' => ucfirst((string) ($activity->event ?? $activity->description ?? 'Activity')),
                'description' => str_replace('_', ' ', (string) $activity->log_name),
                'created_at' => $activity->created_at?->toIso8601String(),
            ])
            ->values()
            ->all();
    }

    /**
     * @return array{total: float, count: int, rows: Collection<int, array<string, mixed>>}
     */
    private function outstandingDues(): array
    {
        $paidTotals = Payment::query()
            ->selectRaw('payable_id, SUM(amount) as paid_total')
            ->where('payable_type', Subscription::class)
            ->groupBy('payable_id');

        $allDues = Subscription::query()
            ->with(['member', 'plan'])
            ->leftJoinSub($paidTotals, 'paid_totals', 'paid_totals.payable_id', '=', 'subscriptions.id')
            ->select('subscriptions.*')
            ->selectRaw('COALESCE(paid_totals.paid_total, 0) as paid_total')
            ->whereRaw('subscriptions.price_paid > COALESCE(paid_totals.paid_total, 0)')
            ->orderBy('end_date')
            ->get();

        return [
            'total' => $allDues->sum(fn (Subscription $subscription): float => (float) $subscription->price_paid - (float) ($subscription->paid_total ?? 0)),
            'count' => $allDues->count(),
            'rows' => $allDues->take(6)->map(fn (Subscription $subscription): array => [
                'id' => $subscription->id,
                'title' => $subscription->member?->name ?? 'Unknown member',
                'description' => ($subscription->plan?->name ?? 'Subscription').' due '.$subscription->end_date?->toDateString(),
                'amount' => number_format((float) $subscription->price_paid - (float) ($subscription->paid_total ?? 0), 2, '.', ''),
            ])->values(),
        ];
    }

    private function completedSignals(CarbonImmutable $weekStart, CarbonImmutable $weekEnd): int
    {
        return Payroll::query()->where('status', 'paid')->whereBetween('paid_at', [$weekStart, $weekEnd])->count()
            + Sale::query()->completed()->whereBetween('created_at', [$weekStart, $weekEnd])->count()
            + Subscription::query()->whereBetween('created_at', [$weekStart, $weekEnd])->count();
    }

    /**
     * @param  Collection<int, array<string, mixed>>  $tasks
     */
    private function focusTitle(Collection $tasks): string
    {
        return $tasks->first()['tag'] ?? 'Gym Ops';
    }

    /**
     * @param  Collection<int, array<string, mixed>>  $tasks
     */
    private function focusDescription(Collection $tasks): string
    {
        if ($tasks->isEmpty()) {
            return 'No urgent operations need attention.';
        }

        return $tasks->first()['title'];
    }

    /**
     * @param  Collection<int, array<string, mixed>>  $tasks
     */
    private function focusHref(Collection $tasks): string
    {
        return $tasks->first()['href'] ?? '/dashboard/operations';
    }
}
