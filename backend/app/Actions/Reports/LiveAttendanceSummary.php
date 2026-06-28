<?php

namespace App\Actions\Reports;

use App\Models\Attendance;
use App\Models\MemberVisit;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

final class LiveAttendanceSummary
{
    /**
     * @return array<string, mixed>
     */
    public function execute(): array
    {
        $now = CarbonImmutable::now();
        $today = $now->toDateString();

        $memberVisits = MemberVisit::query()
            ->with('member:id,name,phone,status')
            ->whereDate('check_in_at', $today)
            ->get();

        $staffAttendance = Attendance::query()
            ->with('employee:id,name,role,status')
            ->whereDate('date', $today)
            ->get();

        $membersInside = $memberVisits
            ->whereNull('check_out_at')
            ->sortByDesc('check_in_at')
            ->values();

        $staffInside = $staffAttendance
            ->whereNotNull('check_in')
            ->whereNull('check_out')
            ->sortByDesc('check_in')
            ->values();

        $hourly = $this->hourlyOccupancy($memberVisits, $staffAttendance, $now);
        $peak = collect($hourly)->sortByDesc('total')->first();

        return [
            'generated_at' => $now->toIso8601String(),
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
     * @return array<int, array<string, int|string>>
     */
    private function hourlyOccupancy(Collection $memberVisits, Collection $staffAttendance, CarbonImmutable $now): array
    {
        $start = $now->startOfDay();

        return collect(range(0, 23))->map(function (int $hour) use ($memberVisits, $staffAttendance, $start, $now): array {
            $slotStart = $start->addHours($hour);
            $slotEnd = $slotStart->endOfHour();

            if ($slotStart->greaterThan($now)) {
                return [
                    'hour' => $slotStart->format('H:00'),
                    'members' => 0,
                    'staff' => 0,
                    'total' => 0,
                ];
            }

            $members = $memberVisits->filter(function (MemberVisit $visit) use ($slotStart, $slotEnd): bool {
                $checkIn = $visit->check_in_at;
                $checkOut = $visit->check_out_at;

                return $checkIn && $checkIn->lessThanOrEqualTo($slotEnd)
                    && (! $checkOut || $checkOut->greaterThanOrEqualTo($slotStart));
            })->count();

            $staff = $staffAttendance->filter(function (Attendance $attendance) use ($slotStart, $slotEnd): bool {
                if (! $attendance->check_in) {
                    return false;
                }

                $checkIn = $slotStart->setTimeFrom($attendance->check_in);
                $checkOut = $attendance->check_out ? $slotStart->setTimeFrom($attendance->check_out) : null;

                return $checkIn->lessThanOrEqualTo($slotEnd)
                    && (! $checkOut || $checkOut->greaterThanOrEqualTo($slotStart));
            })->count();

            return [
                'hour' => $slotStart->format('H:00'),
                'members' => $members,
                'staff' => $staff,
                'total' => $members + $staff,
            ];
        })->all();
    }

    /**
     * @param  Collection<int, MemberVisit>  $memberVisits
     * @param  Collection<int, Attendance>  $staffAttendance
     * @return array<int, array{method: string, count: int}>
     */
    private function scanMethods(Collection $memberVisits, Collection $staffAttendance): array
    {
        return $memberVisits
            ->map(fn (MemberVisit $visit): string => $visit->scan_method ?: 'manual')
            ->merge($staffAttendance->map(fn (Attendance $attendance): string => $attendance->scan_method ?: 'manual'))
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

        return $memberRows
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

        return $memberAlerts
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
