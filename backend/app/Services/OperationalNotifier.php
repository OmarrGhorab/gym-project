<?php

namespace App\Services;

use App\Models\Employee;
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
