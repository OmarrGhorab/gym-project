<?php

namespace App\Http\Requests\Attendance;

use App\Support\HrFinancePermissions;
use Illuminate\Foundation\Http\FormRequest;

class UpdateAttendanceViolationRuleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermissionTo(HrFinancePermissions::PERM_ATTENDANCE_UPDATE) ?? false;
    }

    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'required', 'string', 'max:160'],
            'description' => ['nullable', 'string', 'max:2000'],
            'threshold_minutes' => ['nullable', 'integer', 'min:0', 'max:1440'],
            'deduction_days' => ['sometimes', 'required', 'numeric', 'min:0', 'max:30'],
            'requires_admin_approval' => ['sometimes', 'boolean'],
            'auto_apply_if_unreviewed' => ['sometimes', 'boolean'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }
}
