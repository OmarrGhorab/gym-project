<?php

namespace App\Services;

use App\Actions\ShiftSessions\ComputeShiftSessionTotals;
use App\Models\AttendanceViolation;
use App\Models\Employee;
use App\Models\Expense;
use App\Models\GymTask;
use App\Models\Payroll;
use App\Models\Product;
use App\Models\ShiftSession;
use App\Models\Subscription;
use App\Models\SubscriptionAddon;
use App\Models\User;
use App\Notifications\OperationalNotification;
use App\Support\FoundationPermissions;
use App\Support\NotificationLink;
use App\Support\SubscriptionMessagePayload;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Notification;

class OperationalNotifier
{
    /**
     * @param  array{page: string, entity_type: string|null, entity_id: int|string|null, url: string}  $link
     * @param  array<string, mixed>  $extra
     */
    public function notifyAdmins(string $title, string $body, string $category, array $link, string $severity = 'info', array $extra = []): void
    {
        $this->notifyUsers($this->adminRecipients(), $title, $body, $category, $link, $severity, $extra);
    }

    public function lowStock(Product $product): void
    {
        if (! $product->is_active || $product->stock_quantity > $product->low_stock_threshold) {
            return;
        }

        $this->notifyAdmins(
            title: 'Low stock: '.$product->name,
            body: "{$product->stock_quantity} left. Threshold is {$product->low_stock_threshold}.",
            category: 'inventory.low_stock',
            link: NotificationLink::product($product->id),
            severity: 'warning',
            extra: [
                'product_id' => $product->id,
                'product_name' => $product->name,
                'stock_quantity' => $product->stock_quantity,
                'low_stock_threshold' => $product->low_stock_threshold,
            ],
        );
    }

    public function newSubscription(Subscription $subscription): void
    {
        $subscription->loadMissing(['member:id,name,phone,attendance_code', 'plan:id,name', 'soldBy:id,name', 'payments']);

        $this->notifyAdmins(
            title: 'New subscription member',
            body: ($subscription->member?->name ?? 'Member').' subscribed to '.($subscription->plan?->name ?? 'a plan').'.',
            category: 'membership.subscription_created',
            link: NotificationLink::member(
                $subscription->member_id,
                $subscription->member?->phone,
                ['subscription' => $subscription->id],
            ),
            severity: 'success',
            extra: [
                ...$this->subscriptionMessagePayload($subscription),
                'sold_by' => $subscription->soldBy?->name,
            ],
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function subscriptionMessagePayload(Subscription $subscription): array
    {
        return SubscriptionMessagePayload::for($subscription);
    }

    public function subscriptionEndingSoon(Subscription $subscription): void
    {
        $subscription->loadMissing(['member:id,name,phone,attendance_code', 'plan:id,name', 'payments']);

        $this->notifyAdmins(
            title: 'Membership almost finished',
            body: ($subscription->member?->name ?? 'Member').' ends on '.$subscription->end_date?->toDateString().'.',
            category: 'membership.expiring_soon',
            link: NotificationLink::member(
                $subscription->member_id,
                $subscription->member?->phone,
                ['subscription' => $subscription->id],
            ),
            severity: 'warning',
            extra: $this->subscriptionMessagePayload($subscription),
        );
    }

    public function subscriptionSessionsFinished(Subscription $subscription): void
    {
        $subscription->loadMissing(['member:id,name,phone,attendance_code', 'plan:id,name', 'payments']);

        $this->notifyAdmins(
            title: 'Membership total sessions finished',
            body: ($subscription->member?->name ?? 'Member').' has finished all '.($subscription->sessions_total ?? 0).' total sessions for '.($subscription->plan?->name ?? 'the plan').'.',
            category: 'membership.sessions_finished',
            link: NotificationLink::member(
                $subscription->member_id,
                $subscription->member?->phone,
                ['subscription' => $subscription->id],
            ),
            severity: 'warning',
            extra: [
                ...$this->subscriptionMessagePayload($subscription),
                'sessions_total' => $subscription->sessions_total,
                'sessions_remaining' => 0,
            ],
        );
    }

    public function subscriptionSessionsLow(Subscription $subscription): void
    {
        $subscription->loadMissing(['member:id,name,phone,attendance_code', 'plan:id,name', 'payments']);

        $this->notifyAdmins(
            title: 'Membership sessions running low',
            body: ($subscription->member?->name ?? 'Member').' has only '.$subscription->sessions_remaining.' session(s) remaining for '.($subscription->plan?->name ?? 'the plan').'.',
            category: 'membership.sessions_low',
            link: NotificationLink::member(
                $subscription->member_id,
                $subscription->member?->phone,
                ['subscription' => $subscription->id],
            ),
            severity: 'info',
            extra: $this->subscriptionMessagePayload($subscription),
        );
    }

    public function addonSessionsFinished(SubscriptionAddon $addon): void
    {
        $addon->loadMissing(['member:id,name,phone', 'plan:id,name']);

        $this->notifyAdmins(
            title: 'Extra plan total sessions finished',
            body: ($addon->member?->name ?? 'Member').' has finished all '.($addon->sessions_total ?? 0).' sessions for '.($addon->plan?->name ?? 'the extra plan').'.',
            category: 'membership.addon_sessions_finished',
            link: NotificationLink::member(
                $addon->member_id,
                $addon->member?->phone,
                ['addon' => $addon->id],
            ),
            severity: 'warning',
            extra: [
                'addon_id' => $addon->id,
                'member_id' => $addon->member_id,
                'member_name' => $addon->member?->name,
                'member_phone' => $addon->member?->phone,
                'plan_name' => $addon->plan?->name,
                'sessions_total' => $addon->sessions_total,
                'sessions_remaining' => 0,
            ],
        );
    }

    public function addonSessionsLow(SubscriptionAddon $addon): void
    {
        $addon->loadMissing(['member:id,name,phone', 'plan:id,name']);

        $this->notifyAdmins(
            title: 'Extra plan sessions running low',
            body: ($addon->member?->name ?? 'Member').' has only '.$addon->sessions_remaining.' session(s) remaining for '.($addon->plan?->name ?? 'the extra plan').'.',
            category: 'membership.addon_sessions_low',
            link: NotificationLink::member(
                $addon->member_id,
                $addon->member?->phone,
                ['addon' => $addon->id],
            ),
            severity: 'info',
            extra: [
                'addon_id' => $addon->id,
                'member_id' => $addon->member_id,
                'member_name' => $addon->member?->name,
                'member_phone' => $addon->member?->phone,
                'plan_name' => $addon->plan?->name,
                'sessions_remaining' => $addon->sessions_remaining,
            ],
        );
    }

    public function payrollReady(Payroll $payroll): void
    {
        $payroll->loadMissing('employee.user');
        $employee = $payroll->employee;

        if (! $employee instanceof Employee || ! $employee->user) {
            return;
        }

        $this->notifyUsers(
            collect([$employee->user]),
            title: 'Payroll is nearly ready',
            body: "Your {$payroll->month} payroll is pending review. Net salary: EGP {$payroll->net_salary}.",
            category: 'payroll.ready',
            link: NotificationLink::payroll($payroll->id, $employee->id, $payroll->month),
            severity: 'info',
            extra: [
                'payroll_id' => $payroll->id,
                'employee_id' => $employee->id,
                'month' => $payroll->month,
                'net_salary' => $payroll->net_salary,
            ],
        );
    }

    public function payrollPaid(Payroll $payroll): void
    {
        $payroll->loadMissing('employee.user');
        $employee = $payroll->employee;

        if (! $employee instanceof Employee || ! $employee->user) {
            return;
        }

        $this->notifyUsers(
            collect([$employee->user]),
            title: 'Salary paid',
            body: "Your {$payroll->month} salary was paid. Net salary: EGP {$payroll->net_salary}.",
            category: 'payroll.paid',
            link: NotificationLink::payroll($payroll->id, $employee->id, $payroll->month),
            severity: 'success',
            extra: [
                'payroll_id' => $payroll->id,
                'employee_id' => $employee->id,
                'employee_name' => $employee->name,
                'month' => $payroll->month,
                'base_salary' => number_format((float) $payroll->base_salary, 2, '.', ''),
                'commissions_total' => number_format((float) $payroll->commissions_total, 2, '.', ''),
                'bonuses' => number_format((float) $payroll->bonuses, 2, '.', ''),
                'deductions' => number_format((float) $payroll->deductions, 2, '.', ''),
                'attendance_deductions' => number_format((float) $payroll->attendance_deductions, 2, '.', ''),
                'net_salary' => number_format((float) $payroll->net_salary, 2, '.', ''),
                'paid_at' => $payroll->paid_at?->toIso8601String(),
                'attendance_snapshot' => $payroll->attendance_snapshot,
                'payslip_url' => "/api/payroll/{$payroll->id}/payslip",
            ],
        );
    }

    public function expenseCreated(Expense $expense): void
    {
        $expense->loadMissing('creator');

        $this->notifyAdmins(
            title: 'Expense recorded',
            body: ($expense->creator?->name ?? 'Staff').' recorded '.$expense->category.' expense for EGP '.$expense->amount.'.',
            category: 'expenses.created',
            link: NotificationLink::expense($expense->id, $expense->date?->toDateString()),
            severity: 'warning',
            extra: [
                'expense_id' => $expense->id,
                'expense_category' => $expense->category,
                'amount' => number_format((float) $expense->amount, 2, '.', ''),
                'date' => $expense->date?->toDateString(),
                'created_by' => $expense->created_by,
                'creator_name' => $expense->creator?->name,
                'description' => $expense->description,
            ],
        );
    }

    public function shiftSessionOpened(ShiftSession $session): void
    {
        $session->loadMissing(['shift', 'openedBy', 'openedByEmployee']);

        $shiftName = $session->shift?->name ?? 'Shift';
        $staffName = $session->openedByEmployee?->name ?? $session->openedBy?->name ?? 'System (automatic)';
        $float = number_format((float) $session->opening_float, 2, '.', '');

        $this->notifyAdmins(
            title: 'Shift opened: '.$shiftName,
            body: "{$staffName} opened {$shiftName} session #{$session->id} with an opening float of EGP {$float}.",
            category: 'shifts.session_opened',
            link: NotificationLink::shiftSession($session->id, $session->business_date?->toDateString()),
            severity: 'info',
            extra: [
                'shift_session_id' => $session->id,
                'shift_name' => $session->shift?->name,
                'business_date' => $session->business_date?->toDateString(),
                'opened_at' => $session->opened_at?->toIso8601String(),
                'opened_by' => $session->openedBy?->name,
                'staff_on_duty' => $staffName,
                'opening_float' => $float,
            ],
        );
    }

    public function shiftSessionClosed(ShiftSession $session): void
    {
        $session->loadMissing(['shift', 'openedByEmployee', 'closedBy', 'closedByEmployee']);

        $shiftName = $session->shift?->name ?? 'Shift';
        $staffName = $session->closedByEmployee?->name ?? $session->closedBy?->name ?? 'Staff';
        $expectedCash = number_format((float) $session->expected_cash, 2, '.', '');
        $expectedNet = number_format((float) $session->expected_net, 2, '.', '');

        $this->notifyAdmins(
            title: 'Shift closed: '.$shiftName,
            body: "{$staffName} closed {$shiftName} session #{$session->id}. ".
                "Expected cash in drawer: EGP {$expectedCash}, net: EGP {$expectedNet}. Awaiting handover count.",
            category: 'shifts.session_closed',
            link: NotificationLink::shiftSession($session->id, $session->business_date?->toDateString()),
            severity: 'info',
            extra: [
                'shift_session_id' => $session->id,
                'shift_name' => $session->shift?->name,
                'business_date' => $session->business_date?->toDateString(),
                'closed_at' => $session->closed_at?->toIso8601String(),
                'closed_by' => $session->closedBy?->name,
                'staff_on_duty' => $session->openedByEmployee?->name ?? $staffName,
                'closed_by_staff' => $staffName,
                'opening_float' => number_format((float) $session->opening_float, 2, '.', ''),
                'expected_cash' => $expectedCash,
                'expected_card' => number_format((float) $session->expected_card, 2, '.', ''),
                'expected_bank' => number_format((float) $session->expected_bank, 2, '.', ''),
                'expected_expenses' => number_format((float) $session->expected_expenses, 2, '.', ''),
                'expected_net' => $expectedNet,
            ],
        );
    }

    public function shiftHandoverPending(ShiftSession $session, bool $matches): void
    {
        $session->loadMissing(['shift', 'openedBy', 'closedBy', 'receivedBy']);
        $totals = app(ComputeShiftSessionTotals::class)->handle($session);

        $shiftName = $session->shift?->name ?? 'Shift';
        $closedByName = $session->closedBy?->name ?? 'Staff';

        $body = "{$shiftName} session #{$session->id} closed by {$closedByName}. ".
            "Subscriptions: EGP {$totals['by_source']['subscriptions']}, ".
            "Products: EGP {$totals['by_source']['pos']}, ".
            "Addons: EGP {$totals['by_source']['addons']}. ".
            "Cash: EGP {$totals['cash']}, Card: EGP {$totals['card']}. ".
            ($matches ? 'Handover matched.' : 'Handover variance detected.');

        $this->notifyAdmins(
            title: 'Shift handover: '.$shiftName,
            body: $body,
            category: 'shifts.handover_pending',
            link: NotificationLink::shiftSession($session->id, $session->business_date?->toDateString()),
            severity: $matches ? 'info' : 'warning',
            extra: [
                'shift_session_id' => $session->id,
                'shift_name' => $session->shift?->name,
                'closed_by' => $closedByName,
                'matches' => $matches,
                'opening_float' => number_format((float) $session->opening_float, 2, '.', ''),
                'subscriptions_revenue' => number_format((float) $totals['by_source']['subscriptions'], 2, '.', ''),
                'products_revenue' => number_format((float) $totals['by_source']['pos'], 2, '.', ''),
                'addons_revenue' => number_format((float) $totals['by_source']['addons'], 2, '.', ''),
                'total_collections' => number_format((float) $totals['collections'], 2, '.', ''),
                'cash' => number_format((float) $totals['cash'], 2, '.', ''),
                'card' => number_format((float) $totals['card'], 2, '.', ''),
                'bank' => number_format((float) $totals['bank'], 2, '.', ''),
                'expenses' => number_format((float) $totals['expenses'], 2, '.', ''),
                'expected_net' => number_format((float) $totals['net'], 2, '.', ''),
                'expected_cash' => number_format((float) $session->expected_cash, 2, '.', ''),
                'counted_cash' => number_format((float) $session->counted_cash, 2, '.', ''),
            ],
        );
    }

    /**
     * @param  array<int, array<string, mixed>>  $shifts
     * @param  array{sessions: int, collections: string, expenses: string, net: string, unresolved_sessions: int, shifts_without_session: int}  $totals
     */
    public function dailyShiftSummary(string $businessDate, array $shifts, array $totals): void
    {
        $unresolved = (int) $totals['unresolved_sessions'];
        $withoutSession = (int) $totals['shifts_without_session'];
        $severity = $unresolved > 0 || $withoutSession > 0 ? 'warning' : 'success';

        $body = "{$totals['sessions']} session(s): collections EGP {$totals['collections']}, ".
            "expenses EGP {$totals['expenses']}, net EGP {$totals['net']}.";
        if ($unresolved > 0 || $withoutSession > 0) {
            $body .= " {$unresolved} unresolved session(s), {$withoutSession} scheduled shift(s) without a session.";
        }

        $this->notifyAdmins(
            title: 'Daily shift summary — '.$businessDate,
            body: $body,
            category: 'shifts.daily_summary',
            link: NotificationLink::to('finance', 'shift_day', $businessDate, [
                'from' => $businessDate,
                'to' => $businessDate,
            ]),
            severity: $severity,
            extra: [
                'business_date' => $businessDate,
                'totals' => $totals,
                'shifts' => $shifts,
            ],
        );
    }

    public function subscriptionCancelled(Subscription $subscription, string $refundAmount, User $actor): void
    {
        $subscription->loadMissing(['member:id,name,phone', 'plan:id,name']);

        $startDate = $subscription->start_date?->copy()->startOfDay()
            ?? Carbon::parse($subscription->created_at)->startOfDay();
        $today = Carbon::today();
        $daysInPlan = $startDate->gt($today) ? 0 : (int) $startDate->diffInDays($today) + 1;

        $memberName = $subscription->member?->name ?? 'Member';
        $planName = $subscription->plan?->name ?? 'a plan';
        $formattedRefund = number_format((float) $refundAmount, 2, '.', '');

        $this->notifyAdmins(
            title: 'Membership cancelled with refund',
            body: "{$memberName} cancelled {$planName} after {$daysInPlan} day(s) in plan — refund EGP {$formattedRefund} by {$actor->name}.",
            category: 'membership.cancelled_refund',
            link: NotificationLink::member(
                $subscription->member_id,
                $subscription->member?->phone,
                ['subscription' => $subscription->id],
            ),
            severity: 'warning',
            extra: [
                'subscription_id' => $subscription->id,
                'member_id' => $subscription->member_id,
                'member_name' => $memberName,
                'plan_name' => $planName,
                'days_in_plan' => $daysInPlan,
                'refund_amount' => $formattedRefund,
                'cancelled_by' => $actor->id,
                'cancelled_by_name' => $actor->name,
            ],
        );
    }

    public function offShiftAttendance(Employee $employee, string $date, ?string $checkIn, ?string $shiftName): void
    {
        $this->notifyAdmins(
            title: 'Off-shift staff attendance',
            body: "{$employee->name} checked in outside the assigned shift".($shiftName ? " ({$shiftName})" : '').'.',
            category: 'attendance.off_shift',
            link: NotificationLink::attendance($employee->id, $date),
            severity: 'warning',
            extra: [
                'employee_id' => $employee->id,
                'employee_name' => $employee->name,
                'shift_name' => $shiftName,
                'attendance_date' => $date,
                'check_in' => $checkIn,
            ],
        );
    }

    public function lateAttendance(Employee $employee, string $date, ?string $checkIn, ?string $shiftName, int $lateMinutes): void
    {
        $this->notifyAdmins(
            title: 'Late staff attendance',
            body: "{$employee->name} checked in {$lateMinutes} minute(s) late".($shiftName ? " for {$shiftName}" : '').'.',
            category: 'attendance.late',
            link: NotificationLink::attendance($employee->id, $date),
            severity: 'warning',
            extra: [
                'employee_id' => $employee->id,
                'employee_name' => $employee->name,
                'shift_name' => $shiftName,
                'attendance_date' => $date,
                'check_in' => $checkIn,
                'late_minutes' => $lateMinutes,
            ],
        );
    }

    public function employeeAttendanceWarning(AttendanceViolation $violation): void
    {
        $violation->loadMissing(['employee.user', 'rule']);
        $employee = $violation->employee;

        if (! $employee instanceof Employee || ! $employee->user) {
            return;
        }

        $minutes = $violation->minutes ? " ({$violation->minutes} minute(s))" : '';
        $willDeduct = bccomp((string) $violation->deduction_days, '0.00', 2) === 1;

        $this->notifyUsers(
            collect([$employee->user]),
            title: $willDeduct ? 'Attendance deduction pending' : 'Attendance warning',
            body: $willDeduct
                ? "A {$violation->type}{$minutes} record may deduct {$violation->deduction_days} day(s)."
                : "A {$violation->type}{$minutes} warning was recorded. Please keep an eye on your attendance.",
            category: $willDeduct ? 'attendance.deduction_pending' : 'attendance.warning',
            link: NotificationLink::attendanceViolation(
                $violation->id,
                $employee->id,
                $violation->violation_date?->toDateString(),
                $violation->type,
            ),
            severity: $willDeduct ? 'warning' : 'info',
            extra: [
                'attendance_violation_id' => $violation->id,
                'employee_id' => $employee->id,
                'employee_name' => $employee->name,
                'violation_type' => $violation->type,
                'violation_date' => $violation->violation_date?->toDateString(),
                'minutes' => $violation->minutes,
                'deduction_days' => number_format((float) $violation->deduction_days, 2, '.', ''),
                'status' => $violation->status,
            ],
        );
    }

    public function employeeAttendanceDeduction(AttendanceViolation $violation): void
    {
        $violation->loadMissing(['employee.user', 'payroll']);
        $employee = $violation->employee;

        if (! $employee instanceof Employee || ! $employee->user) {
            return;
        }

        if (bccomp((string) $violation->deduction_amount, '0.00', 2) !== 1) {
            return;
        }

        $this->notifyUsers(
            collect([$employee->user]),
            title: 'Attendance deduction applied',
            body: "EGP {$violation->deduction_amount} was applied for {$violation->type} on {$violation->violation_date?->toDateString()}.",
            category: 'attendance.deduction',
            link: NotificationLink::employeePayroll(
                $employee->id,
                $violation->payroll?->month ?? $violation->violation_date?->toDateString(),
                [
                    'payroll' => $violation->payroll_id,
                    'violation' => $violation->id,
                ],
            ),
            severity: 'warning',
            extra: [
                'attendance_violation_id' => $violation->id,
                'employee_id' => $employee->id,
                'employee_name' => $employee->name,
                'violation_type' => $violation->type,
                'violation_date' => $violation->violation_date?->toDateString(),
                'deduction_amount' => number_format((float) $violation->deduction_amount, 2, '.', ''),
                'deduction_days' => number_format((float) $violation->deduction_days, 2, '.', ''),
                'payroll_id' => $violation->payroll_id,
                'payroll_month' => $violation->payroll?->month,
            ],
        );
    }

    public function employeeAttendanceBonus(Employee $employee, string $date, string $amount, ?string $shiftName): void
    {
        $employee->loadMissing('user');

        if (! $employee->user || bccomp($amount, '0.00', 2) !== 1) {
            return;
        }

        $this->notifyUsers(
            collect([$employee->user]),
            title: 'Attendance bonus earned',
            body: "You earned EGP {$amount} attendance bonus".($shiftName ? " for {$shiftName}" : '').'.',
            category: 'attendance.bonus',
            link: NotificationLink::employeePayroll($employee->id, $date),
            severity: 'success',
            extra: [
                'employee_id' => $employee->id,
                'employee_name' => $employee->name,
                'shift_name' => $shiftName,
                'attendance_date' => $date,
                'bonus_amount' => number_format((float) $amount, 2, '.', ''),
            ],
        );
    }

    public function taskAssigned(GymTask $task): void
    {
        $task->loadMissing('assignedEmployee.user');
        $employee = $task->assignedEmployee;

        if (! $employee instanceof Employee || ! $employee->user) {
            return;
        }

        $this->notifyUsers(
            collect([$employee->user]),
            title: 'New task assigned',
            body: $task->title,
            category: 'tasks.assigned',
            link: NotificationLink::task($task->id),
            severity: $task->priority === 'high' ? 'warning' : 'info',
            extra: [
                'task_id' => $task->id,
                'task_title' => $task->title,
                'priority' => $task->priority,
                'due_date' => $task->due_date?->toDateString(),
            ],
        );
    }

    /**
     * @return Collection<int, User>
     */
    private function adminRecipients(): Collection
    {
        return User::query()
            ->whereHas('roles', fn ($query) => $query->whereIn('name', [
                FoundationPermissions::ROLE_ADMIN,
                FoundationPermissions::ROLE_MANAGER,
            ]))
            ->get();
    }

    /**
     * @param  Collection<int, User>|EloquentCollection<int, User>  $users
     * @param  array{page: string, entity_type: string|null, entity_id: int|string|null, url: string}  $link
     * @param  array<string, mixed>  $extra
     */
    private function notifyUsers(Collection|EloquentCollection $users, string $title, string $body, string $category, array $link, string $severity, array $extra = []): void
    {
        if ($users->isEmpty()) {
            return;
        }

        Notification::send($users, new OperationalNotification([
            'title' => $title,
            'body' => $body,
            'category' => $category,
            'severity' => $severity,
            'url' => $link['url'],
            'link' => $link,
            ...$extra,
        ]));
    }
}
