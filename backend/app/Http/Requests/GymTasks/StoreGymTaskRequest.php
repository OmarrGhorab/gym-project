<?php

namespace App\Http\Requests\GymTasks;

use App\Support\PosPermissions;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreGymTaskRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can(PosPermissions::PERM_REPORTS_VIEW);
    }

    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:191'],
            'description' => ['nullable', 'string', 'max:2000'],
            'status' => ['nullable', 'string', Rule::in(['ideas', 'planned', 'doing', 'review', 'done'])],
            'priority' => ['nullable', 'string', Rule::in(['high', 'medium', 'low'])],
            'category' => ['nullable', 'string', Rule::in(['membership', 'attendance', 'finance', 'payroll', 'inventory', 'maintenance', 'operations'])],
            'progress' => ['nullable', 'integer', 'min:0', 'max:100'],
            'due_date' => ['nullable', 'date_format:Y-m-d'],
            'assigned_employee_id' => ['nullable', 'integer', 'exists:employees,id'],
        ];
    }
}
