<?php

namespace App\Http\Requests\Attendance;

use App\Support\HrFinancePermissions;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ReviewAttendanceViolationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermissionTo(HrFinancePermissions::PERM_ATTENDANCE_UPDATE) ?? false;
    }

    public function rules(): array
    {
        return [
            'status' => ['required', Rule::in(['approved', 'dismissed'])],
            'deduction_days' => ['nullable', 'numeric', 'min:0', 'max:30'],
            'deduction_amount' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
