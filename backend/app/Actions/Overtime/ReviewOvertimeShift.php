<?php

namespace App\Actions\Overtime;

use App\Models\OvertimeShift;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Approve (with a hand-entered bonus), reject, or settle an overtime shift.
 *
 * "Settled" means the admin has already added the bonus into the employee's
 * salary by hand — this action never touches payroll itself.
 */
class ReviewOvertimeShift
{
    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(OvertimeShift $overtimeShift, array $data, User $user): OvertimeShift
    {
        return DB::transaction(function () use ($overtimeShift, $data, $user): OvertimeShift {
            $locked = OvertimeShift::query()->lockForUpdate()->findOrFail($overtimeShift->id);
            $decision = (string) $data['decision'];

            $attributes = match ($decision) {
                OvertimeShift::STATUS_APPROVED => $this->approve($locked, $data),
                OvertimeShift::STATUS_REJECTED => $this->reject($locked),
                OvertimeShift::STATUS_SETTLED => $this->settle($locked, $user),
                default => throw ValidationException::withMessages([
                    'decision' => 'Unsupported overtime decision.',
                ]),
            };

            if (array_key_exists('notes', $data) && $data['notes'] !== null) {
                $attributes['notes'] = $data['notes'];
            }

            $locked->update($attributes + [
                'reviewed_by' => $user->id,
                'reviewed_at' => now(),
            ]);

            $locked->load(['employee', 'coveringFor', 'shift', 'reviewedBy', 'settledBy']);

            activity('overtime_shifts')
                ->causedBy($user)
                ->performedOn($locked)
                ->event($decision)
                ->withProperties([
                    'employee_id' => $locked->employee_id,
                    'employee_name' => $locked->employee?->name,
                    'date' => $locked->date?->toDateString(),
                    'status' => $locked->status,
                    'bonus_amount' => $locked->bonus_amount,
                ])
                ->log('Overtime shift #'.$locked->id.' marked '.$locked->status);

            return $locked;
        });
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function approve(OvertimeShift $overtimeShift, array $data): array
    {
        if ($overtimeShift->status === OvertimeShift::STATUS_SETTLED) {
            throw ValidationException::withMessages([
                'decision' => 'This overtime shift was already settled into a salary.',
            ]);
        }

        return [
            'status' => OvertimeShift::STATUS_APPROVED,
            'bonus_amount' => number_format((float) $data['bonus_amount'], 2, '.', ''),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function reject(OvertimeShift $overtimeShift): array
    {
        if ($overtimeShift->status === OvertimeShift::STATUS_SETTLED) {
            throw ValidationException::withMessages([
                'decision' => 'This overtime shift was already settled into a salary.',
            ]);
        }

        return [
            'status' => OvertimeShift::STATUS_REJECTED,
            'bonus_amount' => '0.00',
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function settle(OvertimeShift $overtimeShift, User $user): array
    {
        if ($overtimeShift->status !== OvertimeShift::STATUS_APPROVED) {
            throw ValidationException::withMessages([
                'decision' => 'Only an approved overtime shift can be marked as added to a salary.',
            ]);
        }

        return [
            'status' => OvertimeShift::STATUS_SETTLED,
            'settled_by' => $user->id,
            'settled_at' => now(),
        ];
    }
}
