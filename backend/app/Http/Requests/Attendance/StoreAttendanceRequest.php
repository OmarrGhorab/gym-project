<?php

namespace App\Http\Requests\Attendance;

use App\Models\Attendance;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreAttendanceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create', Attendance::class);
    }

    public function rules(): array
    {
        return [
            'employee_id' => ['required', 'integer', 'exists:employees,id'],
            'shift_id' => ['nullable', 'integer', 'exists:employee_shifts,id'],
            'date' => ['required', 'date_format:Y-m-d'],
            'check_in' => ['nullable', 'date_format:H:i'],
            'check_out' => ['nullable', 'date_format:H:i', 'after_or_equal:check_in'],
            'status' => ['required', Rule::in(['present', 'absent', 'late', 'excused'])],
            'schedule_status' => ['nullable', Rule::in(['on_shift', 'late', 'off_shift', 'unassigned'])],
            'approval_status' => ['nullable', Rule::in(['approved', 'pending', 'dismissed'])],
            'notes' => ['nullable', 'string', 'max:2000'],
            // Whether a late/early-leave warning should follow from these times.
            'apply_penalty' => ['nullable', 'boolean'],
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if ($validator->errors()->has('employee_id') || $validator->errors()->has('date')) {
                    return;
                }

                $exists = Attendance::query()
                    ->where('employee_id', $this->input('employee_id'))
                    ->whereDate('date', $this->input('date'))
                    ->exists();

                if ($exists) {
                    $validator->errors()->add('date', 'Attendance already exists for this employee and date.');
                }
            },
        ];
    }
}
