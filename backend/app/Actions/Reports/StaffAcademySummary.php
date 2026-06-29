<?php

namespace App\Actions\Reports;

use App\Models\Attendance;
use App\Models\AttendanceViolation;
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
    public function execute(): array
    {
        $now = CarbonImmutable::now();
        $today = $now->toDateString();
        $monthStart = $now->startOfMonth()->toDateString();
        $monthEnd = $now->endOfMonth()->toDateString();

        $activeEmployees = Employee::query()->active()->count();
        $monthlyAttendance = Attendance::query()
            ->whereBetween('date', [$monthStart, $monthEnd])
            ->get(['status', 'late_minutes', 'early_leave_minutes']);
        $attended = $monthlyAttendance->whereIn('status', ['present', 'late'])->count();
        $attendanceRate = $monthlyAttendance->isNotEmpty()
            ? ($attended / max($monthlyAttendance->count(), 1)) * 100
            : 0.0;

        $todayAttendance = Attendance::query()
            ->whereDate('date', $today)
            ->get(['status', 'schedule_status', 'approval_status']);
        $pendingViolations = AttendanceViolation::query()->where('status', 'pending')->count();
        $pendingPayroll = Payroll::query()->where('status', 'pending')->count();

        return [
            'generated_at' => $now->toIso8601String(),
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
                    'label' => 'Warnings Pending',
                    'value' => $pendingViolations,
                    'detail' => 'needs admin decision',
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
            'warning_status' => $this->warningStatus($monthStart, $monthEnd),
            'performance_highlights' => $this->performanceHighlights($monthStart, $monthEnd),
            'upcoming_events' => $this->upcomingEvents($now),
            'today' => [
                'checked_in' => $todayAttendance->whereIn('status', ['present', 'late'])->count(),
                'late' => $todayAttendance->where('status', 'late')->count(),
                'off_shift' => $todayAttendance->where('schedule_status', 'off_shift')->count(),
                'pending_approval' => $todayAttendance->where('approval_status', 'pending')->count(),
            ],
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function shiftSchedule(CarbonImmutable $now): array
    {
        return EmployeeShift::query()
            ->withCount(['employees' => fn ($query) => $query->active()])
            ->where('is_active', true)
            ->orderBy('starts_at')
            ->limit(6)
            ->get()
            ->map(function (EmployeeShift $shift) use ($now): array {
                $startsAtValue = $shift->starts_at instanceof \DateTimeInterface ? $shift->starts_at->format('H:i:s') : (string) $shift->starts_at;
                $endsAtValue = $shift->ends_at instanceof \DateTimeInterface ? $shift->ends_at->format('H:i:s') : (string) $shift->ends_at;
                $startsAt = CarbonImmutable::parse($now->toDateString().' '.$startsAtValue);
                $endsAt = CarbonImmutable::parse($now->toDateString().' '.$endsAtValue);
                $status = match (true) {
                    $now->between($startsAt, $endsAt) => 'in_progress',
                    $now->lessThan($startsAt) => 'upcoming',
                    default => 'completed',
                };

                return [
                    'id' => $shift->id,
                    'name' => $shift->name,
                    'time' => $startsAt->format('H:i').' - '.$endsAt->format('H:i'),
                    'date' => $now->toDateString(),
                    'staff_count' => $shift->employees_count,
                    'grace_minutes' => $shift->grace_minutes,
                    'status' => $status,
                ];
            })
            ->values()
            ->all();
    }

    /**
     * @return array<int, array{label: string, approved: int, pending: int, auto_applied: int}>
     */
    private function warningStatus(string $from, string $to): array
    {
        $statuses = AttendanceViolation::query()
            ->whereBetween('violation_date', [$from, $to])
            ->selectRaw("type, SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_count")
            ->selectRaw("SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count")
            ->selectRaw("SUM(CASE WHEN status = 'auto_applied' THEN 1 ELSE 0 END) as auto_applied_count")
            ->groupBy('type')
            ->orderBy('type')
            ->get();

        if ($statuses->isEmpty()) {
            return [
                ['label' => 'Late', 'approved' => 0, 'pending' => 0, 'auto_applied' => 0],
                ['label' => 'Absence', 'approved' => 0, 'pending' => 0, 'auto_applied' => 0],
                ['label' => 'Off shift', 'approved' => 0, 'pending' => 0, 'auto_applied' => 0],
            ];
        }

        return $statuses->map(fn ($row): array => [
            'label' => str((string) $row->type)->replace('_', ' ')->headline()->toString(),
            'approved' => (int) $row->approved_count,
            'pending' => (int) $row->pending_count,
            'auto_applied' => (int) $row->auto_applied_count,
        ])->values()->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function performanceHighlights(string $from, string $to): array
    {
        $rows = DB::table('employees')
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
                DB::table('commissions')
                    ->select('employee_id', DB::raw('SUM(amount) as commissions_total'))
                    ->whereBetween('created_at', [CarbonImmutable::parse($from)->startOfDay(), CarbonImmutable::parse($to)->endOfDay()])
                    ->groupBy('employee_id'),
                'c',
                'employees.id',
                '=',
                'c.employee_id'
            )
            ->leftJoinSub(
                DB::table('attendance_violations')
                    ->select('employee_id', DB::raw('COUNT(*) as warnings_count'))
                    ->whereBetween('violation_date', [$from, $to])
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
                DB::raw('COALESCE(v.warnings_count, 0) as warnings_count'),
            ])
            ->orderByDesc('attendance_count')
            ->orderByDesc('commissions_total')
            ->limit(5)
            ->get();

        return $rows->map(function ($row, int $index): array {
            $score = min(100, max(20, ((int) $row->attendance_count * 6) + min(35, ((float) $row->commissions_total / 100)) - ((int) $row->warnings_count * 6)));

            return [
                'employee_id' => (int) $row->id,
                'name' => $row->name,
                'role' => $row->role,
                'initials' => $this->initials($row->name),
                'score' => (int) round($score),
                'attendance_count' => (int) $row->attendance_count,
                'commissions_total' => number_format((float) $row->commissions_total, 2, '.', ''),
                'warnings_count' => (int) $row->warnings_count,
                'start' => round(0.35 + ($index * 0.42), 2),
                'duration' => round(1.35 + min(1.2, $score / 85), 2),
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

        return $events->merge($pendingPayroll)
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
