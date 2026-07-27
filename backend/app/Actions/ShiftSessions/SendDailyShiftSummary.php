<?php

namespace App\Actions\ShiftSessions;

use App\Models\DailyShiftSummary;
use App\Models\EmployeeShift;
use App\Models\ShiftSession;
use App\Services\OperationalNotifier;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class SendDailyShiftSummary
{
    public function __construct(
        private readonly ComputeShiftSessionTotals $totals,
        private readonly OperationalNotifier $notifier,
    ) {}

    /**
     * Sends one report after every active shift has reached its scheduled end.
     *
     * @return array{sent: bool, reason: string, business_date: string, sessions: int}
     */
    public function handle(?Carbon $businessDate = null, ?Carbon $now = null): array
    {
        $now ??= now();
        $businessDate ??= $now->copy()->startOfDay();
        $businessDate = $businessDate->copy()->startOfDay();

        $shifts = EmployeeShift::query()
            ->where('is_active', true)
            ->orderBy('starts_at')
            ->orderBy('name')
            ->get();

        if ($shifts->isEmpty()) {
            return $this->result(false, 'no_active_shifts', $businessDate, 0);
        }

        $lastEnd = $shifts
            ->map(fn (EmployeeShift $shift): Carbon => $this->scheduledEnd($shift, $businessDate))
            ->max();

        if (! $lastEnd instanceof Carbon || $now->lt($lastEnd)) {
            return $this->result(false, 'shifts_not_finished', $businessDate, 0);
        }

        return DB::transaction(function () use ($businessDate, $shifts): array {
            $dateString = $businessDate->toDateString();
            $report = DailyShiftSummary::query()
                ->lockForUpdate()
                ->whereDate('business_date', $dateString)
                ->first();

            if (! $report) {
                $report = DailyShiftSummary::query()->create(['business_date' => $dateString]);
            }

            if ($report->sent_at) {
                return $this->result(false, 'already_sent', $businessDate, 0);
            }

            $sessions = ShiftSession::query()
                ->with(['shift', 'openedBy', 'closedBy', 'openedByEmployee', 'closedByEmployee'])
                ->whereDate('business_date', $businessDate->toDateString())
                ->orderBy('employee_shift_id')
                ->orderBy('opened_at')
                ->get();

            $summary = $this->buildSummary($businessDate, $shifts, $sessions);

            $this->notifier->dailyShiftSummary(
                businessDate: $businessDate->toDateString(),
                shifts: $summary['shifts'],
                totals: $summary['totals'],
            );

            $report->update(['sent_at' => now()]);

            return $this->result(true, 'sent', $businessDate, $sessions->count());
        });
    }

    /**
     * @param  Collection<int, EmployeeShift>  $shifts
     * @param  Collection<int, ShiftSession>  $sessions
     * @return array{shifts: array<int, array<string, mixed>>, totals: array<string, mixed>}
     */
    private function buildSummary(Carbon $businessDate, Collection $shifts, Collection $sessions): array
    {
        $totals = [
            'sessions' => 0,
            'collections' => '0.00',
            'expenses' => '0.00',
            'net' => '0.00',
            'unresolved_sessions' => 0,
            'shifts_without_session' => 0,
        ];

        $grouped = $sessions->groupBy('employee_shift_id');

        $shiftRows = $shifts->map(function (EmployeeShift $shift) use ($businessDate, $grouped, &$totals): array {
            /** @var Collection<int, ShiftSession> $shiftSessions */
            $shiftSessions = $grouped->get($shift->id, collect());
            $sessionRows = $shiftSessions->map(function (ShiftSession $session) use (&$totals): array {
                $live = $this->totals->handle($session);
                $resolved = $session->isResolved();

                $totals['sessions']++;
                $totals['collections'] = bcadd($totals['collections'], $live['collections'], 2);
                $totals['expenses'] = bcadd($totals['expenses'], $live['expenses'], 2);
                $totals['net'] = bcadd($totals['net'], $live['net'], 2);
                if (! $resolved) {
                    $totals['unresolved_sessions']++;
                }

                return [
                    'session_id' => $session->id,
                    'status' => $session->status,
                    'staff_on_duty' => $session->openedByEmployee?->name ?? $session->openedBy?->name,
                    'opened_at' => $session->opened_at?->toIso8601String(),
                    'closed_at' => $session->closed_at?->toIso8601String(),
                    'opening_float' => $live['opening_float'],
                    'collections' => $live['collections'],
                    'expenses' => $live['expenses'],
                    'net' => $live['net'],
                    'payment_count' => $live['payment_count'],
                    'expense_count' => $live['expense_count'],
                    'revenue' => $live['by_source'],
                    'payment_methods' => $live['by_method'],
                    'expected' => [
                        'cash' => $this->money($session->expected_cash),
                        'card' => $this->money($session->expected_card),
                        'bank' => $this->money($session->expected_bank),
                        'expenses' => $this->money($session->expected_expenses),
                        'net' => $this->money($session->expected_net),
                    ],
                    'counted' => [
                        'cash' => $this->money($session->counted_cash),
                        'card' => $this->money($session->counted_card),
                        'bank' => $this->money($session->counted_bank),
                        'expenses' => $this->money($session->counted_expenses),
                    ],
                    'variance_notes' => $session->variance_notes,
                ];
            })->values()->all();

            if ($sessionRows === []) {
                $totals['shifts_without_session']++;
            }

            return [
                'shift_id' => $shift->id,
                'shift_name' => $shift->name,
                'scheduled_start' => $this->scheduledStart($shift, $businessDate)->toIso8601String(),
                'scheduled_end' => $this->scheduledEnd($shift, $businessDate)->toIso8601String(),
                'sessions' => $sessionRows,
            ];
        })->values()->all();

        return ['shifts' => $shiftRows, 'totals' => $totals];
    }

    private function scheduledStart(EmployeeShift $shift, Carbon $businessDate): Carbon
    {
        return $businessDate->copy()->setTimeFromTimeString($shift->starts_at?->format('H:i:s') ?? '00:00:00');
    }

    private function scheduledEnd(EmployeeShift $shift, Carbon $businessDate): Carbon
    {
        $start = $this->scheduledStart($shift, $businessDate);
        $end = $businessDate->copy()->setTimeFromTimeString($shift->ends_at?->format('H:i:s') ?? '23:59:59');

        return $end->lte($start) ? $end->addDay() : $end;
    }

    private function money(mixed $amount): ?string
    {
        return $amount === null ? null : bcadd((string) $amount, '0.00', 2);
    }

    /**
     * @return array{sent: bool, reason: string, business_date: string, sessions: int}
     */
    private function result(bool $sent, string $reason, Carbon $businessDate, int $sessions): array
    {
        return [
            'sent' => $sent,
            'reason' => $reason,
            'business_date' => $businessDate->toDateString(),
            'sessions' => $sessions,
        ];
    }
}
