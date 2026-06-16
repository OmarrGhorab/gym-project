<?php

namespace App\Http\Requests\Payroll;

use App\Models\Payroll;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class IndexPayrollRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('viewAny', Payroll::class);
    }

    public function rules(): array
    {
        return [
            'month' => ['nullable', 'string', 'date_format:Y-m'],
            'status' => ['nullable', 'string', Rule::in(['pending', 'paid'])],
            'employee_id' => ['nullable', 'integer', 'exists:employees,id'],
        ];
    }
}
