<?php

namespace App\Http\Requests\Payroll;

use App\Models\Payroll;
use Illuminate\Foundation\Http\FormRequest;

class UpdatePayrollRequest extends FormRequest
{
    public function authorize(): bool
    {
        $payroll = $this->route('payroll');
        if (! $payroll instanceof Payroll) {
            $payroll = Payroll::find($this->route('id') ?? $this->route('payroll'));
        }

        return $payroll ? $this->user()->can('update', $payroll) : false;
    }

    public function rules(): array
    {
        return [
            'bonuses' => ['nullable', 'numeric', 'min:0'],
            'deductions' => ['nullable', 'numeric', 'min:0'],
            'attendance_deductions' => ['nullable', 'numeric', 'min:0'],
        ];
    }
}
