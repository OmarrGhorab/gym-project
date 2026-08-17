<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\WrapsApiResponse;
use App\Support\ShiftDrawerAccess;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ShiftSessionResource extends JsonResource
{
    use WrapsApiResponse;

    public function toArray(Request $request): array
    {
        $scope = ShiftDrawerAccess::scopeFor($request->user(), $this->resource);
        $full = $scope === ShiftDrawerAccess::SCOPE_FULL;
        // Somebody else's shift: it exists, and who is on it, but none of its money.
        $ownMoney = $full || $scope === ShiftDrawerAccess::SCOPE_OWN;

        return [
            'id' => $this->id,
            'employee_shift_id' => $this->employee_shift_id,
            'business_date' => $this->business_date?->toDateString(),
            'opened_at' => $this->opened_at?->toIso8601String(),
            'closed_at' => $this->closed_at?->toIso8601String(),
            'status' => $this->status,
            'opened_automatically' => $this->opened_by === null && $this->opened_by_employee_id === null,
            // Tells the desk how much of this it is allowed to render, so the UI
            // does not have to re-derive the rule from roles and get it wrong.
            'money_scope' => $scope,
            // The float is the previous shift's cash. It stays in the arithmetic
            // an admin reviews, and out of everything an employee is shown —
            // along with expected_cash and expected_net, which contain it.
            'opening_float' => $full ? number_format((float) $this->opening_float, 2, '.', '') : null,
            'expected_cash' => $full && $this->expected_cash !== null ? number_format((float) $this->expected_cash, 2, '.', '') : null,
            'expected_card' => $ownMoney && $this->expected_card !== null ? number_format((float) $this->expected_card, 2, '.', '') : null,
            'expected_bank' => $ownMoney && $this->expected_bank !== null ? number_format((float) $this->expected_bank, 2, '.', '') : null,
            'expected_expenses' => $ownMoney && $this->expected_expenses !== null ? number_format((float) $this->expected_expenses, 2, '.', '') : null,
            'expected_net' => $full && $this->expected_net !== null ? number_format((float) $this->expected_net, 2, '.', '') : null,
            // What this shift actually took in, with the inherited float taken back
            // out. `expected_cash` is the drawer at handover, so on a busy shift
            // opened on a large float it reads high without saying how much of it
            // was earned here; these are that answer, and the ones to judge a
            // shift's takings by.
            'collected_cash' => $full ? $this->collectedCash() : null,
            'collected_total' => $full ? $this->collectedTotal() : null,
            // The employee counted the drawer themselves, so their own count is
            // theirs to see back.
            'counted_cash' => $ownMoney && $this->counted_cash !== null ? number_format((float) $this->counted_cash, 2, '.', '') : null,
            'counted_card' => $ownMoney && $this->counted_card !== null ? number_format((float) $this->counted_card, 2, '.', '') : null,
            'counted_bank' => $ownMoney && $this->counted_bank !== null ? number_format((float) $this->counted_bank, 2, '.', '') : null,
            'counted_expenses' => $ownMoney && $this->counted_expenses !== null ? number_format((float) $this->counted_expenses, 2, '.', '') : null,
            'variance_notes' => $ownMoney ? $this->variance_notes : null,
            'admin_decision' => $ownMoney ? $this->admin_decision : null,
            'admin_reviewed_at' => $ownMoney ? $this->admin_reviewed_at?->toIso8601String() : null,
            // Names the shift the drawer came from, which is the previous employee.
            'previous_session_id' => $full ? $this->previous_session_id : null,
            'shift' => $this->whenLoaded('shift', fn () => (new EmployeeShiftResource($this->shift))->toArray($request)),
            'opened_by' => $this->whenLoaded('openedBy', fn () => $this->openedBy ? (new UserSummaryResource($this->openedBy))->toArray($request) : null),
            'closed_by' => $this->whenLoaded('closedBy', fn () => $this->closedBy ? (new UserSummaryResource($this->closedBy))->toArray($request) : null),
            // The employee of this shift who is accountable for the drawer.
            'staff_on_duty' => $this->whenLoaded('openedByEmployee', fn () => $this->openedByEmployee ? [
                'id' => $this->openedByEmployee->id,
                'name' => $this->openedByEmployee->name,
                'role' => $this->openedByEmployee->role,
            ] : null),
            'closed_by_employee' => $this->whenLoaded('closedByEmployee', fn () => $this->closedByEmployee ? [
                'id' => $this->closedByEmployee->id,
                'name' => $this->closedByEmployee->name,
                'role' => $this->closedByEmployee->role,
            ] : null),
            'received_by' => $this->whenLoaded('receivedBy', fn () => $this->receivedBy ? (new UserSummaryResource($this->receivedBy))->toArray($request) : null),
            'admin_reviewed_by' => $this->whenLoaded('adminReviewer', fn () => $this->adminReviewer ? (new UserSummaryResource($this->adminReviewer))->toArray($request) : null),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }

    /**
     * Cash taken during the shift: the drawer at handover less what it opened on.
     *
     * Null until the shift is closed, because `expected_cash` is only written
     * then — while a shift is open the live totals carry the same figure under
     * `by_method.cash`.
     */
    private function collectedCash(): ?string
    {
        if ($this->expected_cash === null) {
            return null;
        }

        return bcsub(
            number_format((float) $this->expected_cash, 2, '.', ''),
            number_format((float) $this->opening_float, 2, '.', ''),
            2,
        );
    }

    /** Everything taken during the shift, across cash, card and bank. */
    private function collectedTotal(): ?string
    {
        $cash = $this->collectedCash();

        if ($cash === null) {
            return null;
        }

        return bcadd(
            bcadd($cash, number_format((float) $this->expected_card, 2, '.', ''), 2),
            number_format((float) $this->expected_bank, 2, '.', ''),
            2,
        );
    }
}
