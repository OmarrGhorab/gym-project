<?php

namespace App\Actions\ShiftSessions;

use App\Models\EmployeeShift;
use App\Models\Setting;
use App\Models\ShiftSession;
use App\Models\User;
use App\Services\OperationalNotifier;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class SubmitShiftHandover
{
    public function __construct(
        private readonly OperationalNotifier $notifier,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(ShiftSession $session, array $data, User $user): ShiftSession
    {
        return DB::transaction(function () use ($session, $data, $user): ShiftSession {
            $locked = ShiftSession::query()->lockForUpdate()->findOrFail($session->id);

            if (! in_array($locked->status, [ShiftSession::STATUS_PENDING_HANDOVER, ShiftSession::STATUS_DISPUTED], true)) {
                throw ValidationException::withMessages([
                    'session' => 'This session is not awaiting handover.',
                ]);
            }

            $countedCash = bcadd((string) ($data['counted_cash'] ?? '0'), '0.00', 2);
            $countedCard = bcadd((string) ($data['counted_card'] ?? '0'), '0.00', 2);
            $countedBank = bcadd((string) ($data['counted_bank'] ?? '0'), '0.00', 2);
            $countedExpenses = bcadd((string) ($data['counted_expenses'] ?? '0'), '0.00', 2);

            $matches = bccomp($countedCash, (string) $locked->expected_cash, 2) === 0
                && bccomp($countedCard, (string) $locked->expected_card, 2) === 0
                && bccomp($countedBank, (string) $locked->expected_bank, 2) === 0
                && bccomp($countedExpenses, (string) $locked->expected_expenses, 2) === 0;

            $autoAccept = (bool) $this->setting('shifts.handover_auto_accept', false);
            $matchOnly = (bool) $this->setting('shifts.handover_auto_accept_on_match_only', true);

            $status = ShiftSession::STATUS_PENDING_ADMIN;
            if ($autoAccept && ! $this->isFinalShiftOfBusinessDay($locked) && ($matches || ! $matchOnly)) {
                $status = ShiftSession::STATUS_AUTO_ACCEPTED;
            } elseif ($matches && ! $autoAccept) {
                // Exact match still goes to admin unless auto-accept is on — product: admin notified to accept.
                // If auto_accept is false, keep pending_admin even on match so admin can confirm.
                $status = ShiftSession::STATUS_PENDING_ADMIN;
            }

            $locked->update([
                'counted_cash' => $countedCash,
                'counted_card' => $countedCard,
                'counted_bank' => $countedBank,
                'counted_expenses' => $countedExpenses,
                'received_by' => $user->id,
                'variance_notes' => $data['variance_notes'] ?? null,
                'status' => $status,
                'admin_decision' => $status === ShiftSession::STATUS_AUTO_ACCEPTED ? 'accepted' : null,
                'admin_reviewed_at' => $status === ShiftSession::STATUS_AUTO_ACCEPTED ? now() : null,
            ]);

            $fresh = $locked->fresh(['shift', 'openedBy', 'closedBy', 'receivedBy']);

            if ($status === ShiftSession::STATUS_PENDING_ADMIN) {
                $this->notifier->shiftHandoverPending($fresh, $matches);
            }

            return $fresh;
        });
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

    /** The final scheduled desk must always be accepted or rejected by an admin. */
    private function isFinalShiftOfBusinessDay(ShiftSession $session): bool
    {
        $session->loadMissing('shift');
        if ($session->shift === null) {
            return true;
        }

        $endMinute = fn (EmployeeShift $shift): int => $this->endMinute($shift);
        $lastEndMinute = EmployeeShift::query()
            ->where('is_active', true)
            ->get()
            ->map($endMinute)
            ->max();

        return $this->endMinute($session->shift) >= ($lastEndMinute ?? 0);
    }

    private function endMinute(EmployeeShift $shift): int
    {
        $start = $shift->starts_at?->format('H:i') ?? '00:00';
        $end = $shift->ends_at?->format('H:i') ?? '00:00';
        [$startHour, $startMinute] = array_map('intval', explode(':', $start));
        [$endHour, $endMinute] = array_map('intval', explode(':', $end));

        $startTotal = ($startHour * 60) + $startMinute;
        $endTotal = ($endHour * 60) + $endMinute;

        return $endTotal <= $startTotal ? $endTotal + (24 * 60) : $endTotal;
    }
}
