<?php

namespace App\Http\Requests\Payroll;

use App\Models\Payroll;
use Illuminate\Foundation\Http\FormRequest;

class GeneratePayrollRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('generate', Payroll::class);
    }

    public function rules(): array
    {
        return [
            'month' => ['required', 'string', 'regex:/^\d{4}-\d{2}$/'],
        ];
    }

    public function validationData(): array
    {
        return array_merge($this->all(), [
            'month' => $this->query('month'),
        ]);
    }
}
