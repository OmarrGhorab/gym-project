<?php

namespace App\Http\Requests\Overtime;

use App\Models\OvertimeShift;
use App\Support\HrFinancePermissions;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ReviewOvertimeShiftRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermissionTo(HrFinancePermissions::PERM_ATTENDANCE_UPDATE) ?? false;
    }

    public function rules(): array
    {
        return [
            'decision' => ['required', Rule::in([
                OvertimeShift::STATUS_APPROVED,
                OvertimeShift::STATUS_REJECTED,
                OvertimeShift::STATUS_SETTLED,
            ])],
            // The bonus is always typed in by hand — never derived from hours.
            'bonus_amount' => [
                Rule::requiredIf(fn (): bool => $this->input('decision') === OvertimeShift::STATUS_APPROVED),
                'nullable',
                'numeric',
                'min:0',
            ],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
