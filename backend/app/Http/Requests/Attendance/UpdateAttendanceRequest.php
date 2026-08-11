<?php

namespace App\Http\Requests\Attendance;

use App\Models\Attendance;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UpdateAttendanceRequest extends FormRequest
{
    public function authorize(): bool
    {
        $attendance = $this->route('attendance');

        return $attendance instanceof Attendance
            ? $this->user()->can('update', $attendance)
            : false;
    }

    public function rules(): array
    {
        /** @var Attendance|null $attendance */
        $attendance = $this->route('attendance');

        return [
            'employee_id' => ['sometimes', 'required', 'integer', 'exists:employees,id'],
            'shift_id' => ['nullable', 'integer', 'exists:employee_shifts,id'],
            'date' => ['sometimes', 'required', 'date_format:Y-m-d'],
            'check_in' => ['nullable', 'date_format:H:i'],
            'check_out' => ['nullable', 'date_format:H:i', 'after_or_equal:check_in'],
            'status' => ['sometimes', 'required', Rule::in(['present', 'absent', 'excused'])],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if ($validator->errors()->has('employee_id') || $validator->errors()->has('date')) {
                    return;
                }

                /** @var Attendance|null $attendance */
                $attendance = $this->route('attendance');
                if (! $attendance instanceof Attendance) {
                    return;
                }

                $employeeId = $this->input('employee_id', $attendance->employee_id);
                $date = $this->input('date', $attendance->date?->toDateString());

                $exists = Attendance::query()
                    ->where('employee_id', $employeeId)
                    ->whereDate('date', $date)
                    ->whereKeyNot($attendance->id)
                    ->exists();

                if ($exists) {
                    $validator->errors()->add('date', 'Attendance already exists for this employee and date.');
                }
            },
        ];
    }
}
