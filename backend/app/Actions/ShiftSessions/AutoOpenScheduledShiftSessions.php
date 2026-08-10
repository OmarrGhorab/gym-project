<?php

namespace App\Actions\ShiftSessions;

use App\Models\EmployeeShift;
use App\Models\Setting;
use App\Models\ShiftSession;
use App\Services\OperationalNotifier;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/** Opens the currently scheduled drawer without assigning it to an arbitrary employee. */
final class AutoOpenScheduledShiftSessions
{
    public function __construct(private readonly OperationalNotifier $notifier) {}

    /**
     * @return array{opened: int, skipped: int}
     */
    public function handle(?Carbon $now = null): array
    {
        if (! $this->enabled()) {
            return ['opened' => 0, 'skipped' => 0];
        }

        $now ??= now();
        $opened = 0;
        $skipped = 0;

        EmployeeShift::query()
            ->where('is_active', true)
            ->whereHas('employees', fn ($employees) => $employees->active())
            ->orderBy('starts_at')
            ->each(function (EmployeeShift $shift) use ($now, &$opened, &$skipped): void {
                $window = $this->windowFor($shift, $now);
                if ($window === null) {
                    return;
                }

                $session = DB::transaction(function () use ($shift, $window): ?ShiftSession {
                    $exists = ShiftSession::query()
                        ->where('employee_shift_id', $shift->id)
                        ->whereDate('business_date', $window['business_date']->toDateString())
                        ->exists();

                    if ($exists || $this->hasBlockingHandover()) {
                        return null;
                    }

                    $lastResolved = ShiftSession::query()
                        ->whereIn('status', [ShiftSession::STATUS_ACCEPTED, ShiftSession::STATUS_AUTO_ACCEPTED])
                        ->orderByDesc('closed_at')
                        ->first();

                    $sameBusinessDay = $lastResolved?->business_date?->toDateString() === $window['business_date']->toDateString();
                    $openingFloat = $sameBusinessDay
                        ? (string) ($lastResolved->counted_cash ?? $lastResolved->expected_cash ?? '0.00')
                        : '0.00';

                    return ShiftSession::query()->create([
                        'employee_shift_id' => $shift->id,
                        'business_date' => $window['business_date']->toDateString(),
                        // The scheduled start, rather than the scheduler's wake-up time,
                        // makes the money window exact even if a minute is delayed.
                        'opened_at' => $window['start'],
                        'status' => ShiftSession::STATUS_OPEN,
                        'opening_float' => bcadd($openingFloat, '0.00', 2),
                        'previous_session_id' => $lastResolved?->id,
                    ])->load(['shift', 'openedBy', 'openedByEmployee']);
                });

                if ($session === null) {
                    $skipped++;

                    return;
                }

                $opened++;
                $this->notifier->shiftSessionOpened($session);
            });

        return ['opened' => $opened, 'skipped' => $skipped];
    }

    /** @return array{start: Carbon, end: Carbon, business_date: Carbon}|null */
    private function windowFor(EmployeeShift $shift, Carbon $now): ?array
    {
        $startTime = $shift->starts_at?->format('H:i:s');
        $endTime = $shift->ends_at?->format('H:i:s');
        if (! $startTime || ! $endTime) {
            return null;
        }

        $businessDate = $now->copy()->startOfDay();
        $start = $businessDate->copy()->setTimeFromTimeString($startTime);
        $end = $businessDate->copy()->setTimeFromTimeString($endTime);

        if ($end->lte($start)) {
            if ($now->lt($end)) {
                $businessDate->subDay();
                $start->subDay();
            } else {
                $end->addDay();
            }
        }

        if ($now->lt($start) || $now->gte($end)) {
            return null;
        }

        return ['start' => $start, 'end' => $end, 'business_date' => $businessDate];
    }

    private function hasBlockingHandover(): bool
    {
        if (! (bool) $this->setting('shifts.require_handover_to_open', false)) {
            return false;
        }

        return ShiftSession::query()
            ->whereIn('status', [
                ShiftSession::STATUS_PENDING_HANDOVER,
                ShiftSession::STATUS_PENDING_ADMIN,
                ShiftSession::STATUS_DISPUTED,
            ])
            ->exists();
    }

    private function enabled(): bool
    {
        // Off unless the gym opts in. The desk is opened by whoever is standing at
        // it; a scheduler opening drawers nobody asked for is the behaviour this
        // default exists to prevent.
        return (bool) $this->setting('shifts.auto_open_enabled', false);
    }

    private function setting(string $key, mixed $default): mixed
    {
        $value = Setting::query()->where('key', $key)->first()?->value;

        return is_array($value) && array_key_exists('value', $value)
            ? $value['value']
            : ($value ?? $default);
    }
}
