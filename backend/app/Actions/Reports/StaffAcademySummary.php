<?php

namespace App\Actions\Reports;

use App\Models\Attendance;
use App\Models\Employee;
use App\Models\EmployeeShift;
use App\Models\OperationsCalendarEvent;
use App\Models\Payroll;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final class StaffAcademySummary
{
    /**
     * @return array<string, mixed>
     */
    /**
     * @param  array{from?: string|null, to?: string|null}  $params
     * @return array<string, mixed>
     */
    public function execute(array $params = []): array
    {
        $now = CarbonImmutable::now();
        $today = $now->toDateString();
        $monthStart = CarbonImmutable::parse($params['from'] ?? $now->startOfMonth())->toDateString();
        $monthEnd = CarbonImmutable::parse($params['to'] ?? $now->endOfMonth())->toDateString();

        $activeEmployees = Employee::query()->active()->count();
        $monthlyAttendance = Attendance::query()
            ->whereBetween('date', [$monthStart, $monthEnd])
            ->get(['status']);
        $attended = $monthlyAttendance->where('status', 'present')->count();
        $attendanceRate = $monthlyAttendance->isNotEmpty()
            ? ($attended / max($monthlyAttendance->count(), 1)) * 100
            : 0.0;

        $todayAttendance = Attendance::query()
            ->whereDate('date', $today)
            ->get(['status', 'check_in', 'check_out']);
        // Nobody signed them out — the only attendance state left that needs a look.
        $openAttendance = Attendance::query()
            ->whereNotNull('check_in')
            ->whereNull('check_out')
            ->count();
        $pendingPayroll = Payroll::query()->where('status', 'pending')->count();

        return [
            'generated_at' => $now->toIso8601String(),
            'period' => [
                'from' => $monthStart,
                'to' => $monthEnd,
            ],
            'kpis' => [
                [
                    'label' => 'Active Staff',
                    'value' => $activeEmployees,
                    'detail' => 'employees and captains in service',
                    'trend' => null,
                ],
                [
                    'label' => 'Staff Attendance',
                    'value' => number_format($attendanceRate, 1, '.', '').'%',
                    'detail' => $attended.' attended this month',
                    'trend' => null,
                ],
                [
                    'label' => 'Open Attendance',
                    'value' => $openAttendance,
                    'detail' => 'checked in with no check-out',
                    'trend' => null,
                ],
                [
                    'label' => 'Payroll Receipts',
                    'value' => $pendingPayroll,
                    'detail' => 'pending salary receipts',
                    'trend' => null,
                ],
            ],
            'shift_schedule' => $this->shiftSchedule($now),
            'attendance_exceptions' => $this->attendanceExceptions($monthStart, $monthEnd),
            'performance_highlights' => $this->performanceHighlights($monthStart, $monthEnd),
            'upcoming_events' => $this->upcomingEvents($now),
            'today' => [
                'checked_in' => $todayAttendance->where('status', 'present')->count(),
                'absent' => $todayAttendance->where('status', 'absent')->count(),
                'still_in' => $todayAttendance
                    ->filter(fn (Attendance $row): bool => $row->check_in !== null && $row->check_out === null)
                    ->count(),
            ],
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function shiftSchedule(CarbonImmutable $now): array
    {
        return EmployeeShift::query()
            ->with(['employees' => fn ($query) => $query->active()->orderBy('name')->select('id', 'name', 'role', 'shift_id')])
            ->withCount(['employees' => fn ($query) => $query->active()])
            ->where('is_active', true)
            ->orderBy('name')
            ->limit(6)
            ->get()
            ->map(fn (EmployeeShift $shift): array => [
                'id' => $shift->id,
                'name' => $shift->name,
                'date' => $now->toDateString(),
                'staff_count' => $shift->employees_count,
                'staff_names' => $shift->employees
                    ->map(fn (Employee $employee): string => "{$employee->name} ({$employee->role})")
                    ->values()
                    ->all(),
            ])
            ->values()
            ->all();
    }

    /**
     * Attendance exceptions read straight off the attendance rows themselves —
     * there is no rulebook behind them any more, so a row is either still
     * waiting on an admin decision or already settled.
     *
     * @return array<int, array{label: string, pending: int, reviewed: int}>
     */
    private function attendanceExceptions(string $from, string $to): array
    {
        $rows = [
            'absence' => ['label' => 'Absence', 'pending' => 0, 'reviewed' => 0],
            'no_check_out' => ['label' => 'No check-out', 'pending' => 0, 'reviewed' => 0],
            'off_site' => ['label' => 'Off-site scan', 'pending' => 0, 'reviewed' => 0],
        ];

        Attendance::query()
            ->whereBetween('date', [$from, $to])
            ->get(['id', 'status', 'check_in', 'check_out', 'check_in_location_status', 'check_out_location_status'])
            ->each(function (Attendance $attendance) use (&$rows): void {
                // "Pending" is now simply an open day; anything closed has been settled.
                $bucket = $attendance->check_in !== null && $attendance->check_out === null
                    ? 'pending'
                    : 'reviewed';

                foreach ($this->attendanceExceptionTypes($attendance) as $type) {
                    $rows[$type][$bucket]++;
                }
            });

        return array_values($rows);
    }

    /**
     * @return array<int, string>
     */
    private function attendanceExceptionTypes(Attendance $attendance): array
    {
        $types = [];

        if ($attendance->status === 'absent') {
            $types[] = 'absence';
        }

        if ($attendance->check_in !== null && $attendance->check_out === null) {
            $types[] = 'no_check_out';
        }

        if (in_array('outside', [$attendance->check_in_location_status, $attendance->check_out_location_status], true)) {
            $types[] = 'off_site';
        }

        return $types;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function performanceHighlights(string $from, string $to): array
    {
        $fromDateTime = CarbonImmutable::parse($from)->startOfDay();
        $toDateTime = CarbonImmutable::parse($to)->endOfDay();
        $rows = DB::table('employees')
            ->leftJoinSub(
                DB::table('attendance')
                    ->select('employee_id', DB::raw('COUNT(*) as attendance_count'))
                    ->whereBetween('date', [$from, $to])
                    ->where('status', 'present')
                    ->groupBy('employee_id'),
                'a',
                'employees.id',
                '=',
                'a.employee_id'
            )
            ->leftJoinSub(
                DB::table('commissions')
                    ->select('employee_id', DB::raw('SUM(amount) as commissions_total'))
                    ->whereBetween('created_at', [$fromDateTime, $toDateTime])
                    ->groupBy('employee_id'),
                'c',
                'employees.id',
                '=',
                'c.employee_id'
            )
            ->leftJoinSub(
                DB::table('subscription_addons')
                    ->select('coach_id', DB::raw('COUNT(*) as coached_services_count'), DB::raw('SUM(price_paid) as coached_services_revenue'))
                    ->whereBetween('created_at', [$fromDateTime, $toDateTime])
                    ->groupBy('coach_id'),
                'sa',
                'employees.id',
                '=',
                'sa.coach_id'
            )
            ->leftJoinSub(
                DB::table('attendance')
                    ->select('employee_id', DB::raw('COUNT(*) as exceptions_count'))
                    ->whereBetween('date', [$from, $to])
                    ->where(function ($query): void {
                        $query->where('status', 'absent')
                            ->orWhere('check_in_location_status', 'outside')
                            ->orWhere(function ($open): void {
                                $open->whereNotNull('check_in')->whereNull('check_out');
                            });
                    })
                    ->groupBy('employee_id'),
                'v',
                'employees.id',
                '=',
                'v.employee_id'
            )
            ->where('employees.status', 'active')
            ->select([
                'employees.id',
                'employees.name',
                'employees.role',
                DB::raw('COALESCE(a.attendance_count, 0) as attendance_count'),
                DB::raw('COALESCE(c.commissions_total, 0) as commissions_total'),
                DB::raw('COALESCE(sa.coached_services_count, 0) as coached_services_count'),
                DB::raw('COALESCE(sa.coached_services_revenue, 0) as coached_services_revenue'),
                DB::raw('COALESCE(v.exceptions_count, 0) as exceptions_count'),
            ])
            ->whereIn(DB::raw('LOWER(employees.role)'), ['coach', 'captain'])
            ->orderByDesc('coached_services_count')
            ->orderByDesc('commissions_total')
            ->orderByDesc('attendance_count')
            ->get();

        $maxServices = max(1, (int) $rows->max('coached_services_count'));
        $maxRevenue = max(1.0, (float) $rows->max('coached_services_revenue'));
        $maxCommissions = max(1.0, (float) $rows->max('commissions_total'));
        $maxAttendance = max(1, (int) $rows->max('attendance_count'));

        return $rows->map(function ($row) use ($maxAttendance, $maxCommissions, $maxRevenue, $maxServices): array {
            $serviceScore = ((int) $row->coached_services_count / $maxServices) * 40;
            $revenueScore = ((float) $row->coached_services_revenue / $maxRevenue) * 25;
            $commissionScore = ((float) $row->commissions_total / $maxCommissions) * 25;
            $attendanceScore = ((int) $row->attendance_count / $maxAttendance) * 10;
            $exceptionPenalty = (int) $row->exceptions_count * 10;
            $score = min(100, max(0, $serviceScore + $revenueScore + $commissionScore + $attendanceScore - $exceptionPenalty));

            return [
                'employee_id' => (int) $row->id,
                'name' => $row->name,
                'role' => $row->role,
                'initials' => $this->initials($row->name),
                'score' => (int) round($score),
                'attendance_count' => (int) $row->attendance_count,
                'commissions_total' => number_format((float) $row->commissions_total, 2, '.', ''),
                'coached_services_count' => (int) $row->coached_services_count,
                'coached_services_revenue' => number_format((float) $row->coached_services_revenue, 2, '.', ''),
                'exceptions_count' => (int) $row->exceptions_count,
            ];
        })->values()->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function upcomingEvents(CarbonImmutable $now): array
    {
        $events = OperationsCalendarEvent::query()
            ->whereDate('date', '>=', $now->toDateString())
            ->orderBy('date')
            ->limit(5)
            ->get()
            ->map(fn (OperationsCalendarEvent $event): array => [
                'id' => 'event-'.$event->id,
                'date' => $event->date?->toDateString(),
                'title' => $event->title,
                'time' => $event->notes ?: 'Scheduled staff operation',
                'type' => $event->type,
            ]);

        $pendingPayroll = Payroll::query()
            ->with('employee:id,name')
            ->where('status', 'pending')
            ->latest()
            ->limit(5)
            ->get()
            ->map(fn (Payroll $payroll): array => [
                'id' => 'payroll-'.$payroll->id,
                'date' => $now->endOfMonth()->toDateString(),
                'title' => ($payroll->employee?->name ?? 'Employee').' salary receipt',
                'time' => $payroll->month.' payroll',
                'type' => 'payroll',
            ]);

        return $events->toBase()->merge($pendingPayroll->toBase())
            ->sortBy('date')
            ->take(5)
            ->values()
            ->all();
    }

    private function initials(string $name): string
    {
        return collect(explode(' ', trim($name)))
            ->filter()
            ->take(2)
            ->map(fn (string $part): string => mb_substr($part, 0, 1))
            ->implode('');
    }
}
