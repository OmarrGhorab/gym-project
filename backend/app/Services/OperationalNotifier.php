<?php

namespace App\Services;

use App\Models\AttendanceViolation;
use App\Models\Employee;
use App\Models\Expense;
use App\Models\GymTask;
use App\Models\Payroll;
use App\Models\Product;
use App\Models\Subscription;
use App\Models\User;
use App\Notifications\OperationalNotification;
use App\Support\FoundationPermissions;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Notification;

class OperationalNotifier
{
    /**
     * @param  array<string, mixed>  $extra
     */
    public function notifyAdmins(string $title, string $body, string $category, string $url, string $severity = 'info', array $extra = []): void
    {
        $this->notifyUsers($this->adminRecipients(), $title, $body, $category, $url, $severity, $extra);
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
            url: '/dashboard/logistics',
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
        $subscription->loadMissing(['member:id,name', 'plan:id,name', 'soldBy:id,name']);

        $this->notifyAdmins(
            title: 'New subscription member',
            body: ($subscription->member?->name ?? 'Member').' subscribed to '.($subscription->plan?->name ?? 'a plan').'.',
            category: 'membership.subscription_created',
            url: '/dashboard/members',
            severity: 'success',
            extra: [
                'subscription_id' => $subscription->id,
                'member_id' => $subscription->member_id,
                'member_name' => $subscription->member?->name,
                'plan_name' => $subscription->plan?->name,
                'sold_by' => $subscription->soldBy?->name,
                'end_date' => $subscription->end_date?->toDateString(),
            ],
        );
    }

    public function subscriptionEndingSoon(Subscription $subscription): void
    {
        $subscription->loadMissing(['member:id,name', 'plan:id,name']);

        $this->notifyAdmins(
            title: 'Membership almost finished',
            body: ($subscription->member?->name ?? 'Member').' ends on '.$subscription->end_date?->toDateString().'.',
            category: 'membership.expiring_soon',
            url: '/dashboard/crm',
            severity: 'warning',
            extra: [
                'subscription_id' => $subscription->id,
                'member_id' => $subscription->member_id,
                'member_name' => $subscription->member?->name,
                'plan_name' => $subscription->plan?->name,
                'end_date' => $subscription->end_date?->toDateString(),
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
            url: '/dashboard/payroll',
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
            url: '/dashboard/payroll',
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
            url: '/dashboard/finance',
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

    public function offShiftAttendance(Employee $employee, string $date, ?string $checkIn, ?string $shiftName): void
    {
        $this->notifyAdmins(
            title: 'Off-shift staff attendance',
            body: "{$employee->name} checked in outside the assigned shift".($shiftName ? " ({$shiftName})" : '').'.',
            category: 'attendance.off_shift',
            url: '/dashboard/attendance',
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
            url: '/dashboard/attendance',
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
            url: '/dashboard/attendance',
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
            url: '/dashboard/payroll',
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
            url: '/dashboard/payroll',
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
            url: '/dashboard/tasks',
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
     * @param  array<string, mixed>  $extra
     */
    private function notifyUsers(Collection|EloquentCollection $users, string $title, string $body, string $category, string $url, string $severity, array $extra = []): void
    {
        if ($users->isEmpty()) {
            return;
        }

        Notification::send($users, new OperationalNotification([
            'title' => $title,
            'body' => $body,
            'category' => $category,
            'severity' => $severity,
            'url' => $url,
            ...$extra,
        ]));
    }
}
