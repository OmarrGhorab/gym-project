<?php

namespace App\Actions\Employees;

use App\Models\Employee;

final class UpdateEmployee
{
    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(Employee $employee, array $data): Employee
    {
        $employee->update([
            'user_id' => array_key_exists('user_id', $data) ? $data['user_id'] : $employee->user_id,
            'name' => $data['name'] ?? $employee->name,
            'phone' => array_key_exists('phone', $data) ? $data['phone'] : $employee->phone,
            'role' => $data['role'] ?? $employee->role,
            'base_salary' => $data['base_salary'] ?? $employee->base_salary,
            'commission_rate' => $data['commission_rate'] ?? $employee->commission_rate,
            'shift_id' => array_key_exists('shift_id', $data) ? $data['shift_id'] : $employee->shift_id,
            'hire_date' => array_key_exists('hire_date', $data) ? $data['hire_date'] : $employee->hire_date,
            'status' => $data['status'] ?? $employee->status,
        ]);

        return $employee->fresh();
    }
}
