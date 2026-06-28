<?php

namespace App\Http\Requests\Attendance;

use App\Models\Attendance;
use Illuminate\Foundation\Http\FormRequest;

class ScanAttendanceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create', Attendance::class);
    }

    public function rules(): array
    {
        return [
            'qr_token' => ['nullable', 'string', 'max:255', 'required_without:employee_id'],
            'employee_id' => ['nullable', 'integer', 'exists:employees,id', 'required_without:qr_token'],
            'check_in_at' => ['nullable', 'date'],
            'check_out_at' => ['nullable', 'date'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'accuracy_meters' => ['nullable', 'integer', 'min:0', 'max:100000'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
