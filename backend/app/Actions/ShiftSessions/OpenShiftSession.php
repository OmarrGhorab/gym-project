<?php

namespace App\Actions\ShiftSessions;

use App\Models\EmployeeShift;
use App\Models\Setting;
use App\Models\ShiftSession;
use App\Models\User;
use App\Services\OperationalNotifier;
use App\Support\FoundationPermissions;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class OpenShiftSession
{
    public function __construct(
        private readonly ResolveShiftStaff $staff,
        private readonly OperationalNotifier $notifier,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(array $data, User $user): ShiftSession
    {
        $session = DB::transaction(function () use ($data, $user): ShiftSession {
            $shift = EmployeeShift::query()->findOrFail($data['employee_shift_id']);

            $businessDate = isset($data['business_date'])
                ? Carbon::parse($data['business_date'])->toDateString()
                : Carbon::today()->toDateString();

            $forceOpen = (bool) ($data['force_open'] ?? false);
            $isAdmin = method_exists($user, 'hasRole') && $user->hasRole(FoundationPermissions::ROLE_ADMIN);

            if ($forceOpen && ! $isAdmin) {
                throw ValidationException::withMessages([
                    'force_open' => 'Only an administrator can force a shift open outside its schedule.',
                ]);
            }

            if (! $forceOpen && ! $this->isWithinOpeningWindow($shift, $businessDate, now())) {
                throw ValidationException::withMessages([
                    'employee_shift_id' => $shift->name.' cannot be opened outside its scheduled time. Use an authorized force-open only for an exceptional situation.',
                ]);
            }

            // Only an employee of this shift may hold the drawer (admins act on their behalf).
            $employee = $this->staff->handle(
                $shift,
                $user,
                $data['employee_id'] ?? null,
                'employee_id',
                $businessDate,
                true,
            );

            $alreadyOpen = ShiftSession::query()
                ->where('employee_shift_id', $shift->id)
                ->where('status', ShiftSession::STATUS_OPEN)
                ->exists();

            if ($alreadyOpen) {
                throw ValidationException::withMessages([
                    'employee_shift_id' => 'This shift already has an open session.',
                ]);
            }

            $requireHandover = (bool) $this->setting('shifts.require_handover_to_open', true);
            $previous = ShiftSession::query()
                ->whereIn('status', [
                    ShiftSession::STATUS_PENDING_HANDOVER,
                    ShiftSession::STATUS_PENDING_ADMIN,
                    ShiftSession::STATUS_DISPUTED,
                ])
                ->orderByDesc('closed_at')
                ->first();

            if ($requireHandover && $previous && empty($data['force_open'])) {
                throw ValidationException::withMessages([
                    'previous_session' => 'Previous shift session #'.$previous->id.' must be handed over before opening a new one.',
                ]);
            }

            $lastResolved = ShiftSession::query()
                ->whereIn('status', [ShiftSession::STATUS_ACCEPTED, ShiftSession::STATUS_AUTO_ACCEPTED])
                ->orderByDesc('closed_at')
                ->first();

            // Cash carries forward shift-to-shift within one business day. A new business
            // date starts the drawer at zero — the day's takings are banked, not inherited.
            $isNewDay = $lastResolved && $this->businessDate($lastResolved) !== $businessDate;
            $defaultFloat = ($isNewDay || ! $lastResolved)
                ? '0.00'
                : (string) ($lastResolved->counted_cash ?? $lastResolved->expected_cash ?? '0.00');

            // A later shift never accepts a manually supplied float: its drawer must
            // begin with the cash counted by the previous resolved same-day shift.
            // The optional amount is only for the first shift of a new business day.
            $openingFloat = ! $isNewDay && $lastResolved
                ? bcadd($defaultFloat, '0.00', 2)
                : (array_key_exists('opening_float', $data) && $data['opening_float'] !== null && $data['opening_float'] !== ''
                    ? bcadd((string) $data['opening_float'], '0.00', 2)
                    : bcadd($defaultFloat, '0.00', 2));

            return ShiftSession::query()->create([
                'employee_shift_id' => $shift->id,
                'business_date' => $businessDate,
                'opened_at' => now(),
                'opened_by' => $user->id,
                'opened_by_employee_id' => $employee->id,
                'status' => ShiftSession::STATUS_OPEN,
                'opening_float' => $openingFloat,
                'previous_session_id' => $lastResolved?->id ?? $previous?->id,
            ])->load(['shift', 'openedBy', 'openedByEmployee']);
        });

        $this->notifier->shiftSessionOpened($session);

        return $session;
    }

    /** business_date is cast to a Carbon instance, so compare on the date string. */
    private function businessDate(ShiftSession $session): ?string
    {
        $value = $session->business_date;

        if ($value === null) {
            return null;
        }

        return $value instanceof \DateTimeInterface
            ? $value->format('Y-m-d')
            : Carbon::parse((string) $value)->toDateString();
    }

    private function isWithinOpeningWindow(EmployeeShift $shift, string $businessDate, Carbon $at): bool
    {
        $start = Carbon::parse($businessDate.' '.$shift->starts_at->format('H:i'));
        $end = Carbon::parse($businessDate.' '.$shift->ends_at->format('H:i'));

        if ($end->lessThanOrEqualTo($start)) {
            $end->addDay();
        }

        $graceMinutes = max(0, (int) $shift->grace_minutes);

        return $at->betweenIncluded(
            $start->copy()->subMinutes($graceMinutes),
            $end->copy()->addMinutes($graceMinutes),
        );
    }

    private function setting(string $key, mixed $default = null): mixed
    {
        $row = Setting::query()->where('key', $key)->first();

        if (! $row) {
            return $default;
        }

        $value = $row->value;

        if (is_array($value) && array_key_exists('value', $value)) {
            return $value['value'];
        }

        return $value ?? $default;
    }
}
