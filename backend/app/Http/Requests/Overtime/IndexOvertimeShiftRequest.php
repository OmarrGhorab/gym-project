<?php

namespace App\Http\Requests\Overtime;

use App\Models\OvertimeShift;
use App\Support\HrFinancePermissions;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class IndexOvertimeShiftRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermissionTo(HrFinancePermissions::PERM_ATTENDANCE_VIEW) ?? false;
    }

    public function rules(): array
    {
        return [
            'date' => ['nullable', 'date'],
            'month' => ['nullable', 'date_format:Y-m'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'employee_id' => ['nullable', 'integer', 'exists:employees,id'],
            'status' => ['nullable', Rule::in(OvertimeShift::STATUSES)],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ];
    }
}
