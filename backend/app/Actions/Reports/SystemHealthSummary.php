<?php

namespace App\Actions\Reports;

use App\Models\AttendanceViolation;
use App\Models\AttendanceViolationRule;
use App\Models\Employee;
use App\Models\EmployeeShift;
use App\Models\Member;
use App\Models\Payment;
use App\Models\Payroll;
use App\Models\Plan;
use App\Models\Product;
use App\Models\Setting;
use App\Models\Subscription;
use App\Models\User;
use Carbon\CarbonImmutable;
use Spatie\Activitylog\Models\Activity;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

final class SystemHealthSummary
{
    /**
     * @return array<string, mixed>
     */
    public function execute(): array
    {
        $now = CarbonImmutable::now();
        $groups = [
            $this->coreOperationsGroup(),
            $this->staffAttendanceGroup(),
            $this->salesInventoryGroup(),
            $this->financePayrollGroup(),
            $this->securitySettingsGroup(),
        ];
        $rows = collect($groups)->flatMap(fn (array $group) => $group['rows']);
        $warnings = $rows
            ->filter(fn (array $row) => in_array($row['status'], ['warning', 'critical'], true))
            ->values();

        return [
            'generated_at' => $now->toIso8601String(),
            'summary' => [
                'modules_count' => $rows->count(),
                'ready_count' => $rows->where('status', 'ready')->count(),
                'warning_count' => $rows->where('status', 'warning')->count(),
                'critical_count' => $rows->where('status', 'critical')->count(),
                'setup_score' => $this->setupScore($rows->all()),
                'audit_events_count' => Activity::query()->where('created_at', '>=', $now->subDays(7))->count(),
            ],
            'groups' => $groups,
            'setup_warnings' => $warnings
                ->take(8)
                ->map(fn (array $row): array => [
                    'title' => $row['name'],
                    'description' => $row['description'],
                    'status' => $row['status'],
                    'href' => $row['href'],
                ])
                ->all(),
            'audit_activity' => $this->auditActivity(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function coreOperationsGroup(): array
    {
        $members = Member::query()->count();
        $membersWithoutCode = Member::query()->whereNull('attendance_code')->count();
        $plans = Plan::query()->count();
        $activeSubscriptions = Subscription::query()->where('status', 'active')->count();

        return [
            'name' => 'Core Operations',
            'description' => 'Member records, plans, subscriptions, and visit readiness.',
            'rows' => [
                $this->row(
                    'Members registry',
                    'Member profiles are used by subscriptions, QR codes, and visit history.',
                    $members > 0 ? 'ready' : 'warning',
                    'Members',
                    "{$members} records",
                    Member::query()->latest()->value('updated_at'),
                    [
                        $this->check('Total members', (string) $members, $members > 0 ? 'ready' : 'warning'),
                        $this->check('Missing QR codes', (string) $membersWithoutCode, $membersWithoutCode === 0 ? 'ready' : 'warning'),
                    ],
                    '/dashboard/crm',
                ),
                $this->row(
                    'Subscription engine',
                    'Active plans and subscriptions power renewals, freezing, stopping, and dues.',
                    ($plans > 0 && $activeSubscriptions > 0) ? 'ready' : 'warning',
                    'Subscriptions',
                    "{$activeSubscriptions} active",
                    Subscription::query()->latest()->value('updated_at'),
                    [
                        $this->check('Plans', (string) $plans, $plans > 0 ? 'ready' : 'warning'),
                        $this->check('Active subscriptions', (string) $activeSubscriptions, $activeSubscriptions > 0 ? 'ready' : 'warning'),
                    ],
                    '/dashboard/crm',
                ),
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function staffAttendanceGroup(): array
    {
        $activeEmployees = Employee::query()->where('status', 'active')->count();
        $withoutShift = Employee::query()->where('status', 'active')->whereNull('shift_id')->count();
        $withoutUser = Employee::query()->where('status', 'active')->whereNull('user_id')->count();
        $withoutCode = Employee::query()->where('status', 'active')->whereNull('attendance_code')->count();
        $activeShifts = EmployeeShift::query()->where('is_active', true)->count();
        $rules = AttendanceViolationRule::query()->where('is_active', true)->count();
        $pendingViolations = AttendanceViolation::query()->where('status', 'pending')->count();

        return [
            'name' => 'Staff & Attendance',
            'description' => 'Employee shifts, QR scans, warnings, and payroll attendance impact.',
            'rows' => [
                $this->row(
                    'Staff roster',
                    'Active employees should be linked, assigned to shifts, and printable with QR codes.',
                    ($withoutShift + $withoutUser + $withoutCode) === 0 ? 'ready' : 'warning',
                    'Employees',
                    "{$activeEmployees} active",
                    Employee::query()->latest()->value('updated_at'),
                    [
                        $this->check('Without shift', (string) $withoutShift, $withoutShift === 0 ? 'ready' : 'warning'),
                        $this->check('Without user link', (string) $withoutUser, $withoutUser === 0 ? 'ready' : 'warning'),
                        $this->check('Without QR code', (string) $withoutCode, $withoutCode === 0 ? 'ready' : 'warning'),
                    ],
                    '/dashboard/academy',
                ),
                $this->row(
                    'Attendance rules',
                    'Late, absence, early leave, and off-shift rules decide warning and deduction behavior.',
                    ($activeShifts > 0 && $rules > 0) ? ($pendingViolations > 0 ? 'warning' : 'ready') : 'critical',
                    'Attendance',
                    "{$pendingViolations} pending",
                    AttendanceViolation::query()->latest()->value('updated_at'),
                    [
                        $this->check('Active shifts', (string) $activeShifts, $activeShifts > 0 ? 'ready' : 'critical'),
                        $this->check('Active rules', (string) $rules, $rules > 0 ? 'ready' : 'critical'),
                        $this->check('Pending warnings', (string) $pendingViolations, $pendingViolations === 0 ? 'ready' : 'warning'),
                    ],
                    '/dashboard/academy',
                ),
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function salesInventoryGroup(): array
    {
        $activeProducts = Product::query()->where('is_active', true)->count();
        $withoutImages = Product::query()->where('is_active', true)->whereNull('image')->count();
        $lowStock = Product::query()->where('is_active', true)->lowStock()->count();
        $paidPaymentsThisMonth = Payment::query()
            ->where('status', 'paid')
            ->whereBetween('paid_at', [now()->startOfMonth(), now()->endOfDay()])
            ->count();

        return [
            'name' => 'Sales & Inventory',
            'description' => 'POS catalog, product images, stock warnings, and payment flow.',
            'rows' => [
                $this->row(
                    'POS catalog',
                    'Products should be active, stocked, and visible with images in the POS dashboard.',
                    $activeProducts === 0 ? 'warning' : ($withoutImages > 0 ? 'warning' : 'ready'),
                    'Products',
                    "{$activeProducts} active",
                    Product::query()->latest()->value('updated_at'),
                    [
                        $this->check('Active products', (string) $activeProducts, $activeProducts > 0 ? 'ready' : 'warning'),
                        $this->check('Missing images', (string) $withoutImages, $withoutImages === 0 ? 'ready' : 'warning'),
                        $this->check('Low stock', (string) $lowStock, $lowStock === 0 ? 'ready' : 'warning'),
                    ],
                    '/dashboard/logistics',
                ),
                $this->row(
                    'Payments flow',
                    'Paid payment records feed revenue, receipts, outstanding dues, and finance reporting.',
                    $paidPaymentsThisMonth > 0 ? 'ready' : 'warning',
                    'Payments',
                    "{$paidPaymentsThisMonth} this month",
                    Payment::query()->latest()->value('updated_at'),
                    [
                        $this->check('Paid this month', (string) $paidPaymentsThisMonth, $paidPaymentsThisMonth > 0 ? 'ready' : 'warning'),
                    ],
                    '/dashboard/finance',
                ),
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function financePayrollGroup(): array
    {
        $pendingPayroll = Payroll::query()->where('status', 'pending')->count();
        $paidPayroll = Payroll::query()->where('status', 'paid')->count();
        $attendanceDeductions = (float) Payroll::query()->sum('attendance_deductions');

        return [
            'name' => 'Finance & Payroll',
            'description' => 'Payroll receipts, salary deductions, and financial obligations.',
            'rows' => [
                $this->row(
                    'Payroll receipts',
                    'Salary receipt generation uses payroll records, attendance deductions, and employee snapshots.',
                    ($pendingPayroll + $paidPayroll) > 0 ? 'ready' : 'warning',
                    'Payroll',
                    "{$pendingPayroll} pending",
                    Payroll::query()->latest()->value('updated_at'),
                    [
                        $this->check('Pending payroll', (string) $pendingPayroll, $pendingPayroll === 0 ? 'ready' : 'warning'),
                        $this->check('Paid payroll', (string) $paidPayroll, $paidPayroll > 0 ? 'ready' : 'warning'),
                        $this->check('Attendance deductions', $this->money($attendanceDeductions), $attendanceDeductions > 0 ? 'warning' : 'ready'),
                    ],
                    '/dashboard/finance',
                ),
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function securitySettingsGroup(): array
    {
        $users = User::query()->count();
        $usersWithoutRoles = User::query()->doesntHave('roles')->count();
        $roles = Role::query()->count();
        $permissions = Permission::query()->count();
        $settings = Setting::query()->pluck('value', 'key');
        $hasGymCoordinates = filled($settings->get('attendance.gym_latitude'))
            && filled($settings->get('attendance.gym_longitude'))
            && filled($settings->get('attendance.gym_radius_meters'));
        $hasGraceMinutes = filled($settings->get('attendance.default_grace_minutes'));

        return [
            'name' => 'Security & Settings',
            'description' => 'Access control, audit trail, geofence settings, and admin configuration.',
            'rows' => [
                $this->row(
                    'Access control',
                    'Users need assigned roles so the dashboard permission model stays predictable.',
                    ($usersWithoutRoles === 0 && $roles > 0 && $permissions > 0) ? 'ready' : 'warning',
                    'Security',
                    "{$users} users",
                    User::query()->latest()->value('updated_at'),
                    [
                        $this->check('Roles', (string) $roles, $roles > 0 ? 'ready' : 'warning'),
                        $this->check('Permissions', (string) $permissions, $permissions > 0 ? 'ready' : 'warning'),
                        $this->check('Users without role', (string) $usersWithoutRoles, $usersWithoutRoles === 0 ? 'ready' : 'warning'),
                    ],
                    '/dashboard/settings',
                ),
                $this->row(
                    'Gym attendance settings',
                    'Coordinates and radius are required for GPS geofence checks on member and staff scans.',
                    ($hasGymCoordinates && $hasGraceMinutes) ? 'ready' : 'critical',
                    'Settings',
                    $hasGymCoordinates ? 'geofence ready' : 'geofence missing',
                    Setting::query()->latest()->value('updated_at'),
                    [
                        $this->check('Gym coordinates', $hasGymCoordinates ? 'Configured' : 'Missing', $hasGymCoordinates ? 'ready' : 'critical'),
                        $this->check('Grace minutes', $hasGraceMinutes ? 'Configured' : 'Missing', $hasGraceMinutes ? 'ready' : 'warning'),
                    ],
                    '/dashboard/settings',
                ),
            ],
        ];
    }

    /**
     * @param  array<int, array<string, mixed>>  $checks
     * @return array<string, mixed>
     */
    private function row(
        string $name,
        string $description,
        string $status,
        string $category,
        string $metric,
        mixed $lastActivity,
        array $checks,
        string $href,
    ): array {
        return [
            'name' => $name,
            'description' => $description,
            'status' => $status,
            'category' => $category,
            'metric' => $metric,
            'last_activity' => $lastActivity ? CarbonImmutable::parse($lastActivity)->toIso8601String() : null,
            'checks' => $checks,
            'href' => $href,
        ];
    }

    /**
     * @return array<string, string>
     */
    private function check(string $label, string $value, string $status): array
    {
        return compact('label', 'value', 'status');
    }

    /**
     * @param  array<int, array<string, mixed>>  $rows
     */
    private function setupScore(array $rows): int
    {
        if ($rows === []) {
            return 0;
        }

        $score = collect($rows)->sum(fn (array $row): int => match ($row['status']) {
            'ready' => 100,
            'warning' => 65,
            'critical' => 25,
            default => 45,
        });

        return (int) round($score / count($rows));
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function auditActivity(): array
    {
        return Activity::query()
            ->with('causer:id,name')
            ->latest()
            ->limit(8)
            ->get()
            ->map(fn (Activity $activity): array => [
                'id' => $activity->id,
                'log_name' => $activity->log_name,
                'description' => $activity->description,
                'event' => $activity->event,
                'causer' => $activity->causer?->name,
                'created_at' => $activity->created_at?->toIso8601String(),
            ])
            ->values()
            ->all();
    }

    private function money(float $amount): string
    {
        return number_format($amount, 2, '.', '');
    }
}
