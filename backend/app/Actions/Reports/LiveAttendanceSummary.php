<?php

namespace App\Actions\Reports;

use App\Actions\MemberVisits\AutoCloseStaleMemberVisits;
use App\Models\Attendance;
use App\Models\MemberVisit;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

final class LiveAttendanceSummary
{
    public function __construct(
        private readonly AutoCloseStaleMemberVisits $autoCloseStaleVisits,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function execute(array $filters = []): array
    {
        $now = CarbonImmutable::now();
        $this->autoCloseStaleVisits->handle($now->toMutable());
        $date = CarbonImmutable::parse($filters['date'] ?? $now)->startOfDay();
        $comparisonDate = $date->subDay();
        $hours = (int) ($filters['hours'] ?? 24);
        $audience = $filters['audience'] ?? 'all';
        $metric = $filters['metric'] ?? 'occupancy';
        $isToday = $date->isSameDay($now);

        $memberVisits = MemberVisit::query()
            ->with('member:id,name,phone,status')
            ->whereDate('check_in_at', $date->toDateString())
            ->get();

        $staffAttendance = Attendance::query()
            ->with('employee:id,name,role,status')
            ->whereDate('date', $date->toDateString())
            ->get();

        $comparisonMemberVisits = MemberVisit::query()
            ->whereDate('check_in_at', $comparisonDate->toDateString())
            ->get();

        $comparisonStaffAttendance = Attendance::query()
            ->whereDate('date', $comparisonDate->toDateString())
            ->get();

        $membersInside = $isToday ? $memberVisits
            ->whereIn('status', ['allowed', 'flagged'])
            ->whereNull('check_out_at')
            ->sortByDesc('check_in_at')
            ->values() : collect();

        $staffInside = $isToday ? $staffAttendance
            ->whereNotNull('check_in')
            ->whereNull('check_out')
            ->sortByDesc('check_in')
            ->values() : collect();

        $hourly = $this->hourlySeries($memberVisits, $staffAttendance, $comparisonMemberVisits, $comparisonStaffAttendance, $date, $now, [
            'audience' => $audience,
            'hours' => $hours,
            'metric' => $metric,
        ]);
        $peak = collect($hourly)->sortByDesc('total')->first();

        return [
            'generated_at' => $now->toIso8601String(),
            'filters' => [
                'date' => $date->toDateString(),
                'hours' => $hours,
                'audience' => $audience,
                'metric' => $metric,
            ],
            'currently_inside' => [
                'total' => $membersInside->count() + $staffInside->count(),
                'members' => $membersInside->count(),
                'staff' => $staffInside->count(),
            ],
            'today' => [
                'member_visits' => $memberVisits->count(),
                'staff_checkins' => $staffAttendance->whereNotNull('check_in')->count(),
                'flagged_scans' => $memberVisits->where('status', 'flagged')->count()
                    + $staffAttendance->where('check_in_location_status', 'outside')->count()
                    + $staffAttendance->where('check_out_location_status', 'outside')->count(),
                'blocked_visits' => $memberVisits->where('status', 'blocked')->count(),
                'late_staff' => $staffAttendance->where('late_minutes', '>', 0)->count(),
                'peak_hour' => ($peak['total'] ?? 0) > 0 ? $peak['hour'] : null,
            ],
            'hourly' => $hourly,
            'scan_methods' => $this->scanMethods($memberVisits, $staffAttendance),
            'currently_inside_rows' => $this->insideRows($membersInside, $staffInside, $now),
            'alerts' => $this->alerts($memberVisits, $staffAttendance),
        ];
    }

    /**
     * @param  Collection<int, MemberVisit>  $memberVisits
     * @param  Collection<int, Attendance>  $staffAttendance
     * @param  Collection<int, MemberVisit>  $comparisonMemberVisits
     * @param  Collection<int, Attendance>  $comparisonStaffAttendance
     * @param  array{audience: string, hours: int, metric: string}  $filters
     * @return array<int, array<string, int|string>>
     */
    private function hourlySeries(
        Collection $memberVisits,
        Collection $staffAttendance,
        Collection $comparisonMemberVisits,
        Collection $comparisonStaffAttendance,
        CarbonImmutable $date,
        CarbonImmutable $now,
        array $filters,
    ): array {
        $start = $date->startOfDay();
        $isToday = $date->isSameDay($now);
        $visibleHours = max(6, min(24, $filters['hours']));
        $lastHour = $isToday ? min(23, (int) $now->format('G')) : 23;
        $firstHour = max(0, $lastHour - $visibleHours + 1);

        return collect(range($firstHour, $lastHour))->map(function (int $hour) use ($memberVisits, $staffAttendance, $comparisonMemberVisits, $comparisonStaffAttendance, $start, $now, $isToday, $filters): array {
            $slotStart = $start->addHours($hour);
            $slotEnd = $slotStart->endOfHour();

            if ($isToday && $slotStart->greaterThan($now)) {
                return [
                    'hour' => $slotStart->format('H:00'),
                    'members' => 0,
                    'staff' => 0,
                    'total' => 0,
                    'value' => 0,
                    'comparison' => 0,
                ];
            }

            $members = $this->memberPointValue($memberVisits, $slotStart, $slotEnd, $filters['metric']);
            $staff = $this->staffPointValue($staffAttendance, $slotStart, $slotEnd, $filters['metric']);
            $comparisonSlotStart = $slotStart->subDay();
            $comparisonSlotEnd = $comparisonSlotStart->endOfHour();
            $comparisonMembers = $this->memberPointValue($comparisonMemberVisits, $comparisonSlotStart, $comparisonSlotEnd, $filters['metric']);
            $comparisonStaff = $this->staffPointValue($comparisonStaffAttendance, $comparisonSlotStart, $comparisonSlotEnd, $filters['metric']);
            $total = $members + $staff;

            return [
                'hour' => $slotStart->format('H:00'),
                'members' => $members,
                'staff' => $staff,
                'total' => $total,
                'value' => match ($filters['audience']) {
                    'members' => $members,
                    'staff' => $staff,
                    default => $total,
                },
                'comparison' => match ($filters['audience']) {
                    'members' => $comparisonMembers,
                    'staff' => $comparisonStaff,
                    default => $comparisonMembers + $comparisonStaff,
                },
            ];
        })->all();
    }

    private function memberPointValue(Collection $memberVisits, CarbonImmutable $slotStart, CarbonImmutable $slotEnd, string $metric): int
    {
        return match ($metric) {
            'entries' => $memberVisits->filter(fn (MemberVisit $visit): bool => $visit->check_in_at
                && $visit->check_in_at->betweenIncluded($slotStart, $slotEnd))->count(),
            'alerts' => $memberVisits->filter(fn (MemberVisit $visit): bool => $visit->check_in_at
                && $visit->check_in_at->betweenIncluded($slotStart, $slotEnd)
                && in_array($visit->status, ['blocked', 'flagged'], true))->count(),
            default => $memberVisits->filter(function (MemberVisit $visit) use ($slotStart, $slotEnd): bool {
                $checkIn = $visit->check_in_at;
                $checkOut = $visit->check_out_at;

                return in_array($visit->status, ['allowed', 'flagged'], true)
                    && $checkIn
                    && $checkIn->lessThanOrEqualTo($slotEnd)
                    && (! $checkOut || $checkOut->greaterThanOrEqualTo($slotStart));
            })->count(),
        };
    }

    private function staffPointValue(Collection $staffAttendance, CarbonImmutable $slotStart, CarbonImmutable $slotEnd, string $metric): int
    {
        return match ($metric) {
            'entries' => $staffAttendance->filter(function (Attendance $attendance) use ($slotStart, $slotEnd): bool {
                $checkIn = $this->attendanceDateTime($attendance, 'check_in');

                return $checkIn && $checkIn->betweenIncluded($slotStart, $slotEnd);
            })->count(),
            'alerts' => $staffAttendance->filter(function (Attendance $attendance) use ($slotStart, $slotEnd): bool {
                $checkIn = $this->attendanceDateTime($attendance, 'check_in');

                return $checkIn && $checkIn->betweenIncluded($slotStart, $slotEnd)
                    && (((int) $attendance->late_minutes) > 0
                        || $attendance->approval_status === 'pending'
                        || in_array($attendance->schedule_status, ['off_shift', 'late'], true));
            })->count(),
            default => $staffAttendance->filter(function (Attendance $attendance) use ($slotStart, $slotEnd): bool {
                $checkIn = $this->attendanceDateTime($attendance, 'check_in');
                $checkOut = $this->attendanceDateTime($attendance, 'check_out');

                return $checkIn && $checkIn->lessThanOrEqualTo($slotEnd)
                    && (! $checkOut || $checkOut->greaterThanOrEqualTo($slotStart));
            })->count(),
        };
    }

    private function attendanceDateTime(Attendance $attendance, string $field): ?CarbonImmutable
    {
        $value = $attendance->{$field};
        if (! $value) {
            return null;
        }

        return CarbonImmutable::parse($attendance->date->toDateString().' '.$value->format('H:i:s'));
    }

    /**
     * @param  Collection<int, MemberVisit>  $memberVisits
     * @param  Collection<int, Attendance>  $staffAttendance
     * @return array<int, array{method: string, count: int}>
     */
    private function scanMethods(Collection $memberVisits, Collection $staffAttendance): array
    {
        return collect($memberVisits
            ->map(fn (MemberVisit $visit): string => $visit->scan_method ?: 'manual')
            ->all())
            ->merge($staffAttendance->map(fn (Attendance $attendance): string => $attendance->scan_method ?: 'manual')->all())
            ->countBy()
            ->map(fn (int $count, string $method): array => [
                'method' => $method,
                'count' => $count,
            ])
            ->sortByDesc('count')
            ->values()
            ->all();
    }

    /**
     * @param  Collection<int, MemberVisit>  $membersInside
     * @param  Collection<int, Attendance>  $staffInside
     * @return array<int, array<string, mixed>>
     */
    private function insideRows(Collection $membersInside, Collection $staffInside, CarbonImmutable $now): array
    {
        $memberRows = $membersInside->map(fn (MemberVisit $visit): array => [
            'id' => 'member-'.$visit->id,
            'name' => $visit->member?->name ?? 'Unknown member',
            'type' => 'member',
            'check_in_at' => $visit->check_in_at?->toIso8601String(),
            'duration_minutes' => $visit->check_in_at ? (int) $visit->check_in_at->diffInMinutes($now) : 0,
            'scan_method' => $visit->scan_method,
            'status' => $visit->status,
            'location_status' => $visit->check_in_location_status,
        ]);

        $staffRows = $staffInside->map(function (Attendance $attendance) use ($now): array {
            $checkIn = $attendance->check_in
                ? CarbonImmutable::parse($attendance->date->toDateString().' '.$attendance->check_in->format('H:i:s'))
                : null;

            return [
                'id' => 'employee-'.$attendance->id,
                'name' => $attendance->employee?->name ?? 'Unknown employee',
                'type' => 'staff',
                'role' => $attendance->employee?->role,
                'check_in_at' => $checkIn?->toIso8601String(),
                'duration_minutes' => $checkIn ? (int) $checkIn->diffInMinutes($now) : 0,
                'scan_method' => $attendance->scan_method,
                'status' => $attendance->late_minutes > 0 ? 'late' : $attendance->status,
                'location_status' => $attendance->check_in_location_status,
            ];
        });

        return collect($memberRows->values())
            ->merge($staffRows)
            ->sortByDesc('check_in_at')
            ->values()
            ->take(12)
            ->all();
    }

    /**
     * @param  Collection<int, MemberVisit>  $memberVisits
     * @param  Collection<int, Attendance>  $staffAttendance
     * @return array<int, array<string, mixed>>
     */
    private function alerts(Collection $memberVisits, Collection $staffAttendance): array
    {
        $memberAlerts = $memberVisits
            ->filter(fn (MemberVisit $visit): bool => in_array($visit->status, ['blocked', 'flagged'], true))
            ->map(fn (MemberVisit $visit): array => [
                'id' => 'member-'.$visit->id,
                'severity' => $visit->status === 'blocked' ? 'high' : 'medium',
                'type' => 'member',
                'name' => $visit->member?->name ?? 'Unknown member',
                'message' => $visit->alert_reason ?: ucfirst($visit->status).' member visit',
                'time' => $visit->check_in_at?->toIso8601String(),
            ]);

        $staffAlerts = $staffAttendance
            ->filter(fn (Attendance $attendance): bool => ((int) $attendance->late_minutes) > 0
                || $attendance->approval_status === 'pending'
                || in_array($attendance->schedule_status, ['off_shift', 'late'], true))
            ->map(fn (Attendance $attendance): array => [
                'id' => 'staff-'.$attendance->id,
                'severity' => $attendance->approval_status === 'pending' ? 'high' : 'medium',
                'type' => 'staff',
                'name' => $attendance->employee?->name ?? 'Unknown employee',
                'message' => $this->staffAlertMessage($attendance),
                'time' => $attendance->check_in
                    ? CarbonImmutable::parse($attendance->date->toDateString().' '.$attendance->check_in->format('H:i:s'))->toIso8601String()
                    : $attendance->date->toDateString(),
            ]);

        return collect($memberAlerts->values())
            ->merge($staffAlerts)
            ->sortByDesc('time')
            ->values()
            ->take(10)
            ->all();
    }

    private function staffAlertMessage(Attendance $attendance): string
    {
        if ($attendance->approval_status === 'pending') {
            return 'Pending attendance approval';
        }

        if (((int) $attendance->late_minutes) > 0) {
            return "{$attendance->late_minutes} minutes late";
        }

        if ($attendance->schedule_status) {
            return str_replace('_', ' ', ucfirst($attendance->schedule_status));
        }

        return 'Attendance warning';
    }
}
