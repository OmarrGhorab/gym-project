<?php

namespace App\Actions\ShiftSessions;

use App\Models\EmployeeShift;
use App\Models\Setting;
use App\Models\ShiftSession;
use App\Models\User;
use App\Services\OperationalNotifier;
use App\Support\BusinessDay;
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

            // Not Carbon::today(): the desk trades past midnight, and a calendar
            // boundary would file the night shift under tomorrow — which is what
            // made the next morning inherit a drawer it should have opened empty.
            $businessDate = isset($data['business_date'])
                ? Carbon::parse($data['business_date'])->toDateString()
                : BusinessDay::at();

            // Whoever is at the desk names the employee taking the drawer; the
            // shift is only the label the takings are filed under.
            $employee = $this->staff->handle(
                $shift,
                $user,
                $data['employee_id'] ?? null,
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

            // Off by default: an unfinished handover on someone else's session must
            // not stop the person in front of the desk from starting theirs.
            $requireHandover = (bool) $this->setting('shifts.require_handover_to_open', false);
            $previous = ShiftSession::query()
                ->whereIn('status', [
                    ShiftSession::STATUS_PENDING_HANDOVER,
                    ShiftSession::STATUS_PENDING_ADMIN,
                    ShiftSession::STATUS_DISPUTED,
                ])
                ->orderByDesc('closed_at')
                ->first();

            if ($requireHandover && $previous) {
                throw ValidationException::withMessages([
                    'previous_session' => 'Previous shift session #'.$previous->id.' must be handed over before opening a new one.',
                ]);
            }

            $lastResolved = ShiftSession::query()
                ->whereIn('status', [ShiftSession::STATUS_ACCEPTED, ShiftSession::STATUS_AUTO_ACCEPTED])
                ->orderByDesc('closed_at')
                ->first();

            // Cash carries forward shift-to-shift while the desk keeps trading, and the
            // drawer starts at zero once the day's takings have been banked.
            //
            // Two things end a day, and either is enough. The one the gym recognises is
            // the desk having been shut since the last shift ended — that is the real
            // close of business, and no hour passing can trigger it while somebody is
            // still working. The working-day boundary is the backstop for the case that
            // one cannot see: a shift closed minutes before the next opens, but a whole
            // day apart, which is what a forgotten close looks like.
            $isNewDay = $lastResolved && $this->businessDate($lastResolved) !== $businessDate;
            $wasClosedOvernight = $lastResolved && BusinessDay::closedLongEnough($lastResolved->closed_at);
            $startsFresh = ! $lastResolved || $isNewDay || $wasClosedOvernight;

            $defaultFloat = $startsFresh
                ? '0.00'
                : (string) ($lastResolved->counted_cash ?? $lastResolved->expected_cash ?? '0.00');

            // A shift that continues the day never accepts a manually supplied float: its
            // drawer must begin with the cash the previous shift was counted on. The
            // optional amount is only for a drawer that is starting from nothing.
            $openingFloat = ! $startsFresh
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
