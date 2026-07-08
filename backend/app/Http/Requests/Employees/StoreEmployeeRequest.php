<?php

namespace App\Http\Requests\Employees;

use App\Models\Employee;
use Illuminate\Foundation\Http\FormRequest;

class StoreEmployeeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create', Employee::class);
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:30'],
            'role' => ['required', 'string', 'in:employee,captain,manager,coach'],
            'base_salary' => ['nullable', 'numeric', 'min:0'],
            'pay_day' => ['nullable', 'integer', 'min:1', 'max:31'],
            'commission_rate' => ['nullable', 'numeric', 'min:0', 'max:9.9999'],
            'shift_id' => ['nullable', 'integer', 'exists:employee_shifts,id'],
            'hire_date' => ['nullable', 'date'],
            'status' => ['nullable', 'string', 'in:active,inactive'],
            'user_id' => ['nullable', 'integer', 'exists:users,id', 'unique:employees,user_id'],
        ];
    }
}
