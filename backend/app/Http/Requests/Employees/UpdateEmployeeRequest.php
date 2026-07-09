<?php

namespace App\Http\Requests\Employees;

use App\Models\Employee;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateEmployeeRequest extends FormRequest
{
    public function authorize(): bool
    {
        $employee = $this->route('employee');
        if (! $employee instanceof Employee) {
            $employee = Employee::find($this->route('id') ?? $this->route('employee'));
        }

        return $employee ? $this->user()->can('update', $employee) : false;
    }

    public function rules(): array
    {
        $employee = $this->route('employee');
        $employeeId = $employee instanceof Employee ? $employee->id : ($this->route('id') ?? $this->route('employee'));

        return [
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:30'],
            'role' => ['sometimes', 'required', 'string', 'in:employee,captain,manager,coach'],
            'base_salary' => ['nullable', 'numeric', 'min:0'],
            'pay_day' => ['nullable', 'integer', 'min:1', 'max:31'],
            'shift_id' => ['nullable', 'integer', 'exists:employee_shifts,id'],
            'hire_date' => ['nullable', 'date'],
            'status' => ['nullable', 'string', 'in:active,inactive'],
            'user_id' => [
                'nullable',
                'integer',
                'exists:users,id',
                Rule::unique('employees', 'user_id')->ignore($employeeId),
            ],
        ];
    }
}
