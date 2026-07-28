<?php

namespace App\Http\Requests\Overtime;

use App\Support\HrFinancePermissions;
use Illuminate\Foundation\Http\FormRequest;

class StoreOvertimeShiftRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Cover assignments change the day's staffing and can affect payroll. They are
        // therefore an attendance-management action, not a front-desk check-in action.
        return $this->user()?->hasPermissionTo(HrFinancePermissions::PERM_ATTENDANCE_UPDATE) ?? false;
    }

    public function rules(): array
    {
        return [
            'employee_id' => ['required', 'integer', 'exists:employees,id'],
            'covering_for_employee_id' => ['nullable', 'integer', 'exists:employees,id', 'different:employee_id'],
            'employee_shift_id' => ['nullable', 'integer', 'exists:employee_shifts,id'],
            'date' => ['required', 'date'],
            'starts_at' => ['nullable', 'date_format:H:i'],
            'ends_at' => ['nullable', 'date_format:H:i'],
            'hours' => ['nullable', 'numeric', 'min:0', 'max:24'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
