<?php

namespace App\Http\Requests\Overtime;

use App\Support\HrFinancePermissions;
use Illuminate\Foundation\Http\FormRequest;

class SummarizeOvertimeShiftRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        if (! $user) {
            return false;
        }

        // Payroll staff need the totals to type bonuses into salaries by hand.
        return $user->hasPermissionTo(HrFinancePermissions::PERM_ATTENDANCE_VIEW)
            || $user->hasPermissionTo(HrFinancePermissions::PERM_PAYROLL_VIEW);
    }

    public function rules(): array
    {
        return [
            'month' => ['nullable', 'date_format:Y-m'],
        ];
    }
}
