<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\WrapsApiResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ShiftSessionResource extends JsonResource
{
    use WrapsApiResponse;

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'employee_shift_id' => $this->employee_shift_id,
            'business_date' => $this->business_date?->toDateString(),
            'opened_at' => $this->opened_at?->toIso8601String(),
            'closed_at' => $this->closed_at?->toIso8601String(),
            'status' => $this->status,
            'opening_float' => number_format((float) $this->opening_float, 2, '.', ''),
            'expected_cash' => $this->expected_cash !== null ? number_format((float) $this->expected_cash, 2, '.', '') : null,
            'expected_card' => $this->expected_card !== null ? number_format((float) $this->expected_card, 2, '.', '') : null,
            'expected_bank' => $this->expected_bank !== null ? number_format((float) $this->expected_bank, 2, '.', '') : null,
            'expected_expenses' => $this->expected_expenses !== null ? number_format((float) $this->expected_expenses, 2, '.', '') : null,
            'expected_net' => $this->expected_net !== null ? number_format((float) $this->expected_net, 2, '.', '') : null,
            'counted_cash' => $this->counted_cash !== null ? number_format((float) $this->counted_cash, 2, '.', '') : null,
            'counted_card' => $this->counted_card !== null ? number_format((float) $this->counted_card, 2, '.', '') : null,
            'counted_bank' => $this->counted_bank !== null ? number_format((float) $this->counted_bank, 2, '.', '') : null,
            'counted_expenses' => $this->counted_expenses !== null ? number_format((float) $this->counted_expenses, 2, '.', '') : null,
            'variance_notes' => $this->variance_notes,
            'admin_decision' => $this->admin_decision,
            'admin_reviewed_at' => $this->admin_reviewed_at?->toIso8601String(),
            'previous_session_id' => $this->previous_session_id,
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
}
