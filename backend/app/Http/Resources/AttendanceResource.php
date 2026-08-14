<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\WrapsApiResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AttendanceResource extends JsonResource
{
    use WrapsApiResponse;

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'employee_id' => $this->employee_id,
            'employee' => $this->whenLoaded('employee', fn () => [
                'id' => $this->employee->id,
                'name' => $this->employee->name,
                'role' => $this->employee->role,
                'attendance_code' => $this->employee->attendance_code,
            ]),
            'shift_id' => $this->shift_id,
            'shift' => $this->whenLoaded('shift', fn () => [
                'id' => $this->shift?->id,
                'name' => $this->shift?->name,
            ]),
            'date' => $this->date?->toDateString(),
            'check_in' => $this->check_in?->format('H:i'),
            'check_in_location' => [
                'latitude' => $this->check_in_latitude ? (float) $this->check_in_latitude : null,
                'longitude' => $this->check_in_longitude ? (float) $this->check_in_longitude : null,
                'accuracy_meters' => $this->check_in_accuracy_meters,
                'distance_meters' => $this->check_in_distance_meters,
                'status' => $this->check_in_location_status,
            ],
            'check_out' => $this->check_out?->format('H:i'),
            'check_out_location' => [
                'latitude' => $this->check_out_latitude ? (float) $this->check_out_latitude : null,
                'longitude' => $this->check_out_longitude ? (float) $this->check_out_longitude : null,
                'accuracy_meters' => $this->check_out_accuracy_meters,
                'distance_meters' => $this->check_out_distance_meters,
                'status' => $this->check_out_location_status,
            ],
            'status' => $this->status,
            'scan_method' => $this->scan_method,
            'notes' => $this->notes,
            'absence_reason' => $this->absence_reason,
            'absence_deduction_amount' => number_format((float) $this->absence_deduction_amount, 2, '.', ''),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
