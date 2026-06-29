<?php

namespace App\Http\Requests\Reports;

use App\Support\PosPermissions;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateOperationsCalendarEventRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can(PosPermissions::PERM_REPORTS_VIEW);
    }

    public function rules(): array
    {
        return [
            'date' => ['required', 'date_format:Y-m-d'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after_or_equal:starts_at'],
            'all_day' => ['nullable', 'boolean'],
            'title' => ['required', 'string', 'max:191'],
            'type' => ['nullable', 'string', Rule::in(['manual', 'shift', 'class', 'pt_session', 'maintenance', 'renewal', 'payroll', 'attendance', 'inventory', 'finance'])],
            'status' => ['nullable', 'string', Rule::in(['scheduled', 'done', 'cancelled', 'delayed'])],
            'assigned_employee_id' => ['nullable', 'integer', 'exists:employees,id'],
            'location' => ['nullable', 'string', 'max:191'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
