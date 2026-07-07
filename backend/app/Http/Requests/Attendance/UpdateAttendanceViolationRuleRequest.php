<?php

namespace App\Http\Requests\Attendance;

use App\Support\HrFinancePermissions;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateAttendanceViolationRuleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermissionTo(HrFinancePermissions::PERM_ATTENDANCE_UPDATE) ?? false;
    }

    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'required', 'string', Rule::in([
                'Late more than 15 minutes',
                'Late more than 30 minutes',
                'Late more than 60 minutes',
                'Absence without approval',
                'Leaving before shift end',
                'Attendance outside assigned shift',
            ])],
            'description' => ['nullable', 'string', 'max:2000'],
            'threshold_minutes' => ['nullable', 'integer', 'min:0', 'max:1440'],
            'warning_count_before_deduction' => ['sometimes', 'integer', 'min:0', 'max:365'],
            'deduction_days' => ['sometimes', 'required', 'numeric', 'min:0', 'max:30'],
            'requires_admin_approval' => ['sometimes', 'boolean'],
            'auto_apply_if_unreviewed' => ['sometimes', 'boolean'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }
}
